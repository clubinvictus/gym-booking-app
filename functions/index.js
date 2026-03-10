const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// API Configuration for EasySocial
// These should ideally be set in Firebase functions config:
// firebase functions:config:set easysocial.token="YOUR_TOKEN"
const getEasySocialConfig = () => {
    return {
        token: functions.config().easysocial?.token || process.env.EASYSOCIAL_TOKEN || 'MISSING_TOKEN',
        apiUrl: 'https://easysocial.io/api/v1/messages' // Replace with actual EasySocial endpoint
    };
};

/**
 * Helper to fetch phone numbers for client and trainer
 */
async function getContactNumbers(clientId, trainerId) {
    let clientPhone = null;
    let trainerPhone = null;

    if (clientId) {
        const clientSnap = await db.collection('clients').doc(clientId).get();
        if (clientSnap.exists) {
            clientPhone = clientSnap.data().phone;
        } else {
            // Also check users collection just in case
            const userSnap = await db.collection('users').doc(clientId).get();
            if (userSnap.exists) clientPhone = userSnap.data().phone;
        }
    }

    if (trainerId) {
        const trainerSnap = await db.collection('trainers').doc(trainerId).get();
        if (trainerSnap.exists) {
            trainerPhone = trainerSnap.data().phone;
        }
    }

    return { clientPhone, trainerPhone };
}

/**
 * Helper to fetch all Manager phone numbers
 */
async function getManagerPhones() {
    const managers = [];
    const usersSnap = await db.collection('users').where('role', '==', 'manager').get();

    usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.phone) managers.push(data.phone);
    });

    return managers;
}

/**
 * Sends a WhatsApp Template message via EasySocial
 */
async function sendWhatsAppTemplate(to, templateName, variables) {
    if (!to || !to.startsWith('+')) {
        console.log(`Skipping WhatsApp message to invalid phone number: ${to}`);
        return false;
    }

    const config = getEasySocialConfig();

    // Formatting the request exactly as EasySocial/Meta expects.
    // NOTE: This structure might need adjustment depending on EasySocial's exact API docs.
    const payload = {
        to: to,
        type: "template",
        template: {
            name: templateName,
            language: { code: "en" }, // Adjust depending on your template's language
            components: [
                {
                    type: "body",
                    parameters: variables.map(text => ({ type: "text", text: String(text) }))
                }
            ]
        }
    };

    try {
        console.log(`Sending template '${templateName}' to ${to}...`);
        await axios.post(config.apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Successfully sent '${templateName}' to ${to}`);
        return true;
    } catch (error) {
        const errData = error.response?.data || error.message;
        console.error(`Failed to send WhatsApp message to ${to}. Error:`, JSON.stringify(errData));
        return false;
    }
}

/**
 * Firestore Trigger for the 'sessions' collection
 */
exports.onSessionWritten = functions.firestore
    .document('sessions/{sessionId}')
    .onWrite(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();

        // If data is identical, exit (edge case)
        if (beforeData && afterData && JSON.stringify(beforeData) === JSON.stringify(afterData)) {
            return null;
        }

        const isCreate = !change.before.exists;
        const isDelete = !change.after.exists;
        const isUpdate = change.before.exists && change.after.exists;

        const data = isDelete ? beforeData : afterData;

        // Setup Date and Time explicitly
        const sessionDate = new Date(data.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const sessionTime = data.time;

        const { clientPhone, trainerPhone } = await getContactNumbers(data.clientId, data.trainerId);

        // Determine who made the booking: Client vs Admin/Manager
        const isClientBooking = (data.createdBy === data.clientName) && data.clientName;

        // --- RECURRING SERIES LOGIC ---
        // Debounce via locking so we only send ONE message for the whole batch of 100+ recurring bookings.
        if (data.seriesId) {
            const seriesAction = isDelete ? 'delete' : (isCreate ? 'create' : 'update');
            const lockRef = db.collection('whatsapp_locks').doc(`${data.seriesId}_${seriesAction}`);

            let gotLock = false;
            try {
                await db.runTransaction(async (t) => {
                    const doc = await t.get(lockRef);
                    if (!doc.exists) {
                        t.set(lockRef, { processedAt: admin.firestore.FieldValue.serverTimestamp() });
                        gotLock = true;
                    }
                });
            } catch (err) {
                console.error("Transaction lock error:", err);
            }

            if (!gotLock) {
                console.log(`Lock exists for series ${data.seriesId}. Skipping duplicate notification.`);
                return null; // Another function instance already sent the series notification.
            }

            // We acquired the lock! Send the recurring message.
            if (isCreate) {
                // Client Confirmation: `Hi {{1}}, your recurring {{5}} sessions with {{2}} are confirmed. They will begin on {{3}} at {{4}}. Thank you.`
                if (clientPhone) sendWhatsAppTemplate(clientPhone, "client_recurring_confirm", [data.clientName, data.trainerName, sessionDate, sessionTime, data.recurringDetails]);

                // Trainer Alert: `New Recurring Booking: A {{4}} series for {{1}} with you has been scheduled, starting {{2}} at {{3}}. Please check your calendar.`
                if (trainerPhone) sendWhatsAppTemplate(trainerPhone, "trainer_recurring_alert", [data.clientName, sessionDate, sessionTime, data.recurringDetails]);

                // Manager Alert
                if (isClientBooking) {
                    const managerPhones = await getManagerPhones();
                    for (const mPhone of managerPhones) {
                        await sendWhatsAppTemplate(mPhone, "manager_recurring_alert", [data.clientName, data.trainerName, sessionDate, sessionTime, data.recurringDetails]);
                    }
                }
            } else if (isDelete) {
                console.log("Recurring series deleted - Need to ensure delete templates exist if required.");
            }

            return null;
        }

        // --- SINGLE BOOKING LOGIC ---

        if (isCreate) {
            // Client Confirmation: `Hi {{1}}, your booking with {{2}} is confirmed for {{3}} at {{4}}...`
            if (clientPhone) await sendWhatsAppTemplate(clientPhone, "client_single_confirm", [data.clientName, data.trainerName, sessionDate, sessionTime]);

            // Trainer Alert: `New Booking Alert: A session for {{1}} with you has been scheduled on {{2}} at {{3}}...`
            if (trainerPhone) await sendWhatsAppTemplate(trainerPhone, "trainer_single_alert", [data.clientName, sessionDate, sessionTime]);

            if (isClientBooking) {
                const managerPhones = await getManagerPhones();
                for (const mPhone of managerPhones) {
                    await sendWhatsAppTemplate(mPhone, "manager_single_alert", [data.clientName, data.trainerName, sessionDate, sessionTime]);
                }
            }
        } else if (isDelete) {
            // Client Cancel: `Hi {{1}}, your session with {{2}} on {{3}} at {{4}} has been canceled...`
            if (clientPhone) await sendWhatsAppTemplate(clientPhone, "client_single_cancel", [data.clientName, data.trainerName, sessionDate, sessionTime]);

            // Trainer Cancel
            if (trainerPhone) await sendWhatsAppTemplate(trainerPhone, "trainer_single_cancel", [data.clientName, sessionDate, sessionTime]);

            if (isClientBooking) {
                const managerPhones = await getManagerPhones();
                for (const mPhone of managerPhones) {
                    await sendWhatsAppTemplate(mPhone, "manager_single_cancel", [data.clientName, data.trainerName, sessionDate, sessionTime]);
                }
            }
        } else if (isUpdate) {
            const timeChanged = beforeData.time !== afterData.time || beforeData.date !== afterData.date;

            if (timeChanged) {
                // Client Reschedule: `Hi {{1}}, your session with {{2}} has been rescheduled. It is now confirmed for {{3}} at {{4}}...`
                if (clientPhone) await sendWhatsAppTemplate(clientPhone, "client_single_reschedule", [data.clientName, data.trainerName, sessionDate, sessionTime]);

                // Trainer Reschedule
                if (trainerPhone) await sendWhatsAppTemplate(trainerPhone, "trainer_single_reschedule", [data.clientName, sessionDate, sessionTime]);

                if (isClientBooking) {
                    const managerPhones = await getManagerPhones();
                    for (const mPhone of managerPhones) {
                        await sendWhatsAppTemplate(mPhone, "manager_single_reschedule", [data.clientName, data.trainerName, sessionDate, sessionTime]);
                    }
                }
            }
        }

        return null;
    });
