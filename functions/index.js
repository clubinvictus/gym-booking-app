const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const qs = require("qs");

admin.initializeApp();
const db = admin.firestore();

// (Legacy API Token removed as we are transitioning to Webhooks)

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
    const managers = new Set();
    
    // 1. Check users collection
    const usersSnap = await db.collection('users').where('role', '==', 'manager').get();
    usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.phone) managers.add(data.phone);
    });

    // 2. Fallback to managers collection for safety
    const managersSnap = await db.collection('managers').get();
    managersSnap.forEach(doc => {
        const data = doc.data();
        if (data.phone) managers.add(data.phone);
    });

    return Array.from(managers);
}

/**
 * Sends a WhatsApp Template message via an EasySocial Webhook
 */
async function sendWhatsAppTemplate(to, templateName, variables) {
    if (!to || !to.startsWith('+')) {
        console.log(`Skipping WhatsApp message to invalid phone number: ${to}`);
        return false;
    }

    try {
        // Fetch the specific Webhook URL from Firestore settings
        const settingsSnap = await db.collection('settings').doc('easysocial_webhooks').get();
        if (!settingsSnap.exists) {
            console.error("Missing 'easysocial_webhooks' document in 'settings' collection. Cannot send message.");
            return false;
        }

        const webhooks = settingsSnap.data();
        const webhookUrl = webhooks[templateName];

        if (!webhookUrl) {
            console.warn(`No webhook URL configured for template: '${templateName}'. Skipping.`);
            return false;
        }

        // Flatten payload for EasySocial's custom mapping
        // We send it as standard form data instead of a JSON string per test_webhook.js
        const payload = qs.stringify({
            phone: to.replace('+', ''),
            template: templateName,
            ...variables
        });

        console.log(`Sending webhook for '${templateName}' to ${webhookUrl}...`);
        await axios.post(webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log(`Successfully sent webhook for '${templateName}' to ${to}`);
        return true;
    } catch (error) {
        const errData = error.response?.data || error.message;
        console.error(`Failed to send WhatsApp webhook for ${to}. Error:`, JSON.stringify(errData));
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
        const sessionId = context.params.sessionId;

        // Sync trainer_busy_slots collection for conflict detection
        if (isDelete) {
            await db.collection('trainer_busy_slots').doc(sessionId).delete();
        } else {
            await db.collection('trainer_busy_slots').doc(sessionId).set({
                trainerId: data.trainerId,
                date: data.date,
                time: data.time,
                siteId: data.siteId || 'default'
            });
        }

        // Setup Date and Time explicitly
        const sessionDate = new Date(data.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const sessionTime = data.time;

        const { clientPhone, trainerPhone } = await getContactNumbers(data.clientId, data.trainerId);

        // Determine who made the booking: Client vs Admin/Manager
        // A client booking is when createdBy matches the clientName
        const isClientBooking = (data.createdBy === data.clientName) && data.clientName;

        const isSelfInflicted = (data.createdBy === "Unknown User") || (data.createdBy !== data.clientName);
        const shouldAlertManagers = isClientBooking || (isSelfInflicted && data.createdBy !== "System");

        // --- RATE LIMIT ENFORCEMENT ---
        // We enforce a strict 1-session-per-day limit for clients to prevent API abuse/bots from spamming bookings.
        if (isClientBooking && (!data.seriesId || isDelete)) {
            try {
                if (isCreate) {
                    const targetDatePrefix = data.date.split('T')[0];
                    const limitRef = db.collection('rate_limits').doc(`${data.clientId}_${targetDatePrefix}`);
                    
                    const allowed = await db.runTransaction(async (t) => {
                        const doc = await t.get(limitRef);
                        if (!doc.exists) {
                            t.set(limitRef, { count: 1 });
                            return true;
                        } else if (doc.data().count >= 1) {
                            return false; // Limit exceeded
                        } else {
                            t.update(limitRef, { count: doc.data().count + 1 });
                            return true;
                        }
                    });
                    
                    if (!allowed) {
                        console.warn(`Rate Limit Exceeded: Client ${data.clientId} booked >1 session for ${targetDatePrefix}. Deleting session ${sessionId}.`);
                        await db.collection('sessions').doc(sessionId).delete();
                        await db.collection('activity_logs').add({
                            action: 'rate_limit_blocked',
                            isRecurring: false,
                            sessionDetails: { clientName: data.clientName, date: data.date, time: data.time },
                            performedBy: { uid: 'system', role: 'system', name: 'Security Enforcer' },
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            siteId: data.siteId || 'default'
                        });
                        return null; // Stop processing Webhooks
                    }
                } else if (isDelete) {
                    const targetDatePrefix = data.date.split('T')[0];
                    const limitRef = db.collection('rate_limits').doc(`${data.clientId}_${targetDatePrefix}`);
                    await db.runTransaction(async (t) => {
                        const doc = await t.get(limitRef);
                        if (doc.exists && doc.data().count > 0) {
                            t.update(limitRef, { count: doc.data().count - 1 });
                        }
                    });
                } else if (isUpdate) {
                    const oldDatePrefix = beforeData.date.split('T')[0];
                    const newDatePrefix = afterData.date.split('T')[0];
                    
                    if (oldDatePrefix !== newDatePrefix) {
                        const limitRefNew = db.collection('rate_limits').doc(`${data.clientId}_${newDatePrefix}`);
                        const limitRefOld = db.collection('rate_limits').doc(`${data.clientId}_${oldDatePrefix}`);
                        
                        const allowed = await db.runTransaction(async (t) => {
                            const docNew = await t.get(limitRefNew);
                            if (docNew.exists && docNew.data().count >= 1) return false;
                            
                            if (!docNew.exists) t.set(limitRefNew, { count: 1 });
                            else t.update(limitRefNew, { count: docNew.data().count + 1 });
                            
                            const docOld = await t.get(limitRefOld);
                            if (docOld.exists && docOld.data().count > 0) t.update(limitRefOld, { count: docOld.data().count - 1 });
                            
                            return true;
                        });
                        
                        if (!allowed) {
                            console.warn(`Rate Limit Exceeded on Reschedule: Reverting ${sessionId}.`);
                            await db.collection('sessions').doc(sessionId).set(beforeData);
                            return null;
                        }
                    }
                }
            } catch (err) {
                 console.error("Rate limit transaction failed", err);
            }
        }

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

            // Prepare common variables for recurring bookings
            const vars = {
                clientName: data.clientName,
                trainerName: data.trainerName,
                date: sessionDate,
                time: sessionTime,
                recurringDetails: data.recurringDetails
            };

            // We acquired the lock! Send the recurring message.
            if (isCreate) {
                // Client Confirmation
                if (clientPhone) sendWhatsAppTemplate(clientPhone, "client_recurring_confirm", vars);

                // Trainer Alert
                if (trainerPhone) sendWhatsAppTemplate(trainerPhone, "trainer_recurring_alert", vars);

                // Manager Alert
                if (shouldAlertManagers) {
                    const managerPhones = await getManagerPhones();
                    for (const mPhone of managerPhones) {
                        await sendWhatsAppTemplate(mPhone, "manager_recurring_alert", vars);
                    }
                }
            } else if (isDelete) {
                // Client Cancel
                if (clientPhone) await sendWhatsAppTemplate(clientPhone, "client_recurring_cancel", vars);

                // Trainer Cancel
                if (trainerPhone) await sendWhatsAppTemplate(trainerPhone, "trainer_recurring_cancel", vars);

                // Manager Cancel
                const managerPhones = await getManagerPhones();
                for (const mPhone of managerPhones) {
                    await sendWhatsAppTemplate(mPhone, "manager_recurring_cancel", vars);
                }
            }

            return null;
        }

        // --- SINGLE BOOKING LOGIC ---

        // Prepare common variables for single bookings
        const singleVars = {
            clientName: data.clientName,
            trainerName: data.trainerName,
            date: sessionDate,
            time: sessionTime
        };

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        if (isCreate) {
            // Client Confirmation
            if (clientPhone) {
                await sendWhatsAppTemplate(clientPhone, "client_single_confirm", singleVars);
                await delay(1500);
            }

            // Trainer Alert
            if (trainerPhone) {
                await sendWhatsAppTemplate(trainerPhone, "trainer_single_alert", singleVars);
                await delay(1500);
            }

            if (shouldAlertManagers) {
                const managerPhones = await getManagerPhones();
                for (const mPhone of managerPhones) {
                    await sendWhatsAppTemplate(mPhone, "manager_single_alert", singleVars);
                    await delay(1500);
                }
            }
        } else if (isDelete) {
            // Client Cancel
            if (clientPhone) {
                await sendWhatsAppTemplate(clientPhone, "client_single_cancel", singleVars);
                await delay(1500);
            }

            // Trainer Cancel
            if (trainerPhone) {
                await sendWhatsAppTemplate(trainerPhone, "trainer_single_cancel", singleVars);
                await delay(1500);
            }

            if (shouldAlertManagers) {
                const managerPhones = await getManagerPhones();
                for (const mPhone of managerPhones) {
                    await sendWhatsAppTemplate(mPhone, "manager_single_cancel", singleVars);
                    await delay(1500);
                }
            }
        } else if (isUpdate) {
            const timeChanged = beforeData.time !== afterData.time || beforeData.date !== afterData.date;

            if (timeChanged) {
                // Client Reschedule
                if (clientPhone) {
                    await sendWhatsAppTemplate(clientPhone, "client_single_reschedule", singleVars);
                    await delay(1500);
                }

                // Trainer Reschedule
                if (trainerPhone) {
                    await sendWhatsAppTemplate(trainerPhone, "trainer_single_reschedule", singleVars);
                    await delay(1500);
                }

                if (shouldAlertManagers) {
                    const managerPhones = await getManagerPhones();
                    for (const mPhone of managerPhones) {
                        await sendWhatsAppTemplate(mPhone, "manager_single_reschedule", singleVars);
                        await delay(1500);
                    }
                }
            }
        }

        return null;
    });
