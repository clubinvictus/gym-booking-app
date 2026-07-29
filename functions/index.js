const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const qs = require("qs");
const { DateTime } = require("luxon");

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
 * Throws permission-denied unless the calling user is a manager/admin. Every existing onCall
 * function in this file only checks context.auth (fine for self-service actions on a client's
 * own booking), but trainer management is deliberately restricted to isManager() at the
 * firestore.rules level — a callable that bypasses rules via the Admin SDK needs the same
 * restriction re-checked explicitly inside the function body.
 */
async function requireManager(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const uid = context.auth.uid;
    const [managerDoc, userDoc] = await Promise.all([
        db.collection('managers').doc(uid).get(),
        db.collection('users').doc(uid).get()
    ]);
    const role = userDoc.data()?.role;
    if (!managerDoc.exists && role !== 'manager' && role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Managers only.');
    }
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

        // Flatten payload for EasySocial's custom mapping
        // We send it as standard form data instead of a JSON string per test_webhook.js
        // (built before the URL check below so a missing config still logs what would have sent)
        const payload = qs.stringify({
            phone: to.replace('+', ''),
            template: templateName,
            ...variables
        });

        if (!webhookUrl) {
            console.warn(`No webhook URL configured for template: '${templateName}'. Payload would have been:`, payload);
            return false;
        }

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

        // Sync trainer_busy_slots collection for conflict detection.
        // Bulk recurring-series writes (createRecurringSeries / updateRecurringSeriesFuture)
        // already write the matching trainer_busy_slots doc in the same batch as the session,
        // and mark the session with busySlotSynced so we don't redundantly re-write it here
        // via ~hundreds of separate trigger invocations for one series action.
        if (isDelete) {
            await db.collection('trainer_busy_slots').doc(sessionId).delete();
        } else if (!data.busySlotSynced) {
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

        // Retroactive Safety Fallback: Fetch client name if missing from session doc
        if (!data.clientName && data.clientId) {
            try {
                const userDoc = await db.collection('users').doc(data.clientId).get();
                if (userDoc.exists) {
                    data.clientName = userDoc.data().name || 'Client';
                }
            } catch (err) {
                console.error('Fallback client lookup failed:', err);
                data.clientName = 'Client';
            }
        }

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
        // Priority Check: If this is explicitly marked as a single deletion, bypass recurring logic
        if (data.seriesId && !(isDelete && data.deletionIntent === 'single')) {
            const seriesAction = isDelete ? 'delete' : (isCreate ? 'create' : 'update');
            const lockRef = db.collection('whatsapp_locks').doc(`${data.seriesId}_${seriesAction}`);

            let gotLock = false;
            try {
                await db.runTransaction(async (t) => {
                    const doc = await t.get(lockRef);
                    if (!doc.exists) {
                        // expiresAt: consumed by a Firestore TTL policy on this field (configured
                        // via `gcloud firestore fields ttls update`, not deployable through
                        // firestore.rules/indexes.json) — long-lived recurring_series rules make
                        // this collection's growth pattern worse than before, since a rule can now
                        // run indefinitely instead of a one-shot 2-year materialization.
                        const expiresAt = new Date();
                        expiresAt.setDate(expiresAt.getDate() + 90);
                        t.set(lockRef, {
                            processedAt: admin.firestore.FieldValue.serverTimestamp(),
                            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
                        });
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

        // --- LIMITLESS OPEN ROUTING ---
        // Limitless Open is a shared session (up to 3 clients per slot, see WeekGrid/ResourceGrid's
        // 3-cap chip logic) — it gets its own WhatsApp templates instead of the generic single-
        // booking ones below, and needs the *joining* client's contact details, not necessarily the
        // original booker's (data.clientId/clientName/clientPhone only ever reflect whoever created
        // the session — BookingModal's handleJoin only arrayUnion's onto `clients`, it never updates
        // those top-level fields). data.clients is the real roster; its last entry is the most
        // recent joiner on both create and join-triggered updates.
        if (data.serviceName === 'Limitless Open') {
            const rosterClients = Array.isArray(data.clients) ? data.clients : [];
            const latestClient = rosterClients.length > 0 ? rosterClients[rosterClients.length - 1] : {};
            const latestClientId = latestClient.id || data.clientId || null;
            const latestClientName = latestClient.name || data.clientName || 'Client';

            let latestClientPhone = latestClient.phone || data.clientPhone || null;
            if (!latestClientPhone && latestClientId) {
                const clientSnap = await db.collection('clients').doc(latestClientId).get();
                if (clientSnap.exists) {
                    latestClientPhone = clientSnap.data().phone || null;
                } else {
                    const userSnap = await db.collection('users').doc(latestClientId).get();
                    if (userSnap.exists) latestClientPhone = userSnap.data().phone || null;
                }
            }

            const limitlessVars = {
                clientName: latestClientName,
                trainerName: data.trainerName,
                date: sessionDate,
                time: sessionTime
            };

            const isLimitClientBooking = (data.createdBy === latestClientName) && latestClientName;
            const shouldAlertLimitManagers = isLimitClientBooking || (data.createdBy !== "Unknown User" && data.createdBy !== "System");

            if (isCreate && !data.seriesId) {
                if (isLimitClientBooking) {
                    if (latestClientPhone) await sendWhatsAppTemplate(latestClientPhone, 'open_single_client_booking_client', limitlessVars);
                    if (trainerPhone) await sendWhatsAppTemplate(trainerPhone, 'open_single_client_booking_trainer', limitlessVars);
                    if (shouldAlertLimitManagers) {
                        const managerPhones = await getManagerPhones();
                        for (const mPhone of managerPhones) await sendWhatsAppTemplate(mPhone, 'open_single_client_booking_manager', limitlessVars);
                    }
                } else {
                    if (latestClientPhone) await sendWhatsAppTemplate(latestClientPhone, 'open_single_admin_booking_client', limitlessVars);
                    if (trainerPhone) await sendWhatsAppTemplate(trainerPhone, 'open_single_admin_booking_trainer', limitlessVars);
                }
            }
            return null; // Early exit so the generic single-booking logic below doesn't also fire
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
            const trainerChanged = beforeData.trainerId !== afterData.trainerId;

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

            // Trainer reassignment (e.g. from resolving a deactivated trainer's upcoming
            // sessions) — same date/time, different trainer, so timeChanged above won't have
            // fired anything. Only the client is notified here; the outgoing trainer isn't (they
            // already know they're being deactivated, and the incoming trainer already gets
            // trainer_single_alert-equivalent context via their own calendar).
            if (trainerChanged && !timeChanged) {
                if (clientPhone) {
                    await sendWhatsAppTemplate(clientPhone, "client_trainer_changed", singleVars);
                    await delay(1500);
                }
            }
        }

        return null;
    });

/**
 * processTrialBooking: Secure backend flow for lead-generation trials.
 * 1. Creates Firebase Auth user.
 * 2. Executes Firestore transaction for Client, Session, and Activity Log.
 * 3. Triggers WhatsApp webhooks on success.
 * 4. Rolls back Auth if the transaction fails.
 */
exports.processTrialBooking = functions.region('us-central1').https.onCall(async (data, context) => {
    const { 
        name, 
        email, 
        phone, 
        password, 
        slot, 
        service, 
        siteId 
    } = data;

    if (!email || !password || !name) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    const normalizedEmail = email.toLowerCase();
    let authUser = null;

    try {
        // 1. Auth Creation
        try {
            authUser = await admin.auth().createUser({
                email: normalizedEmail,
                password: password,
                displayName: name
            });
        } catch (authErr) {
            if (authErr.code === 'auth/email-already-in-use') {
                throw new functions.https.HttpsError('already-exists', 'Looks like you already have an account! Please log in to book your session.');
            }
            throw authErr;
        }

        // 2. Database Transaction
        const result = await db.runTransaction(async (transaction) => {
            // --- DATA PARSING FOR DASHBOARD VISIBILITY ---
            const [hours, minutes] = slot.time.split(':').map(Number);
            const startDate = new Date(slot.date);
            startDate.setHours(hours, minutes, 0, 0);
            
            const endDate = new Date(startDate);
            endDate.setMinutes(endDate.getMinutes() + 60);

            const startTime = admin.firestore.Timestamp.fromDate(startDate);
            const endTime = admin.firestore.Timestamp.fromDate(endDate);

            const userRef = db.collection('users').doc(authUser.uid);
            const clientRef = db.collection('clients').doc();
            const sessionRef = db.collection('sessions').doc();
            const activityRef = db.collection('activity_logs').doc();

            // a. User Profile (Private)
            transaction.set(userRef, {
                email: normalizedEmail,
                role: 'client',
                name: name,
                clientId: clientRef.id,
                phone: phone,
                membership_tier: 'lead',
                siteId: siteId || 'default',
                createdAt: new Date().toISOString()
            });

            // b. Client Record (Public/Admin)
            transaction.set(clientRef, {
                uid: authUser.uid, // ADDED: Critical for Client Dashboard lookup
                name: name,
                email: normalizedEmail,
                phone: phone,
                membership_tier: 'lead',
                joined: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                status: 'Active',
                siteId: siteId || 'default',
                createdAt: new Date().toISOString()
            });

            // c. Trial Session
            transaction.set(sessionRef, {
                clients: [{
                    id: clientRef.id,
                    name: name,
                    email: normalizedEmail
                }],
                clientIds: [clientRef.id], // Canonical field used by SessionService queries
                clientName: name, // Legacy support
                trainerId: slot.trainerId,
                trainerName: slot.trainerName,
                serviceId: service.id,
                serviceName: service.name,
                startTime: startTime, // ADDED: Native Timestamp for Calendar views
                endTime: endTime,     // ADDED: Native Timestamp for Calendar views
                time: slot.time,      // Kept for backward compatibility/reference
                day: slot.day,
                date: slot.date,
                status: 'pending',
                type: 'Trial',
                isTrial: true,
                siteId: siteId || 'default',
                createdAt: new Date().toISOString(),
                createdBy: 'System (Trial Flow)'
            });

            // d. Activity Log
            transaction.set(activityRef, {
                action: 'booked',
                sessionDetails: {
                    clientName: name,
                    trainerName: slot.trainerName,
                    serviceName: service.name,
                    date: slot.date,
                    time: slot.time
                },
                performedBy: {
                    uid: authUser.uid,
                    name: name,
                    role: 'client'
                },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                siteId: siteId || 'default',
                notes: 'New Trial Booked & Account Created'
            });

            return { clientId: clientRef.id };
        });

        // 3. Webhook Trigger (WhatsApp)
        // We do this AFTER the transaction succeeds to ensure data consistency.
        const vars = {
            clientName: name,
            date: new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
            time: slot.time,
            trainerName: slot.trainerName
        };

        // Welcome message to client
        await sendWhatsAppTemplate(phone, "trial_welcome", vars);

        // Alert to Managers
        const managerPhones = await getManagerPhones();
        for (const mPhone of managerPhones) {
            await sendWhatsAppTemplate(mPhone, "manager_trial_alert", vars);
        }

        return { 
            success: true, 
            uid: authUser.uid, 
            clientId: result.clientId 
        };

    } catch (error) {
        console.error('CRITICAL: processTrialBooking execution failed.');
        console.error('Error Stack:', error.stack);
        console.error('Error Details:', JSON.stringify(error));

        // 4. Rollback Auth if Firestore transaction failed
        if (authUser) {
            try {
                await admin.auth().deleteUser(authUser.uid);
                console.log('Successfully rolled back Auth user after failed transaction.');
            } catch (deleteError) {
                console.error('Failed to cleanup Auth user during rollback:', deleteError);
            }
        }

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        throw new functions.https.HttpsError('internal', `Backend error: ${error.message || 'Unknown failure'}`);
    }
});

/**
 * Firestore write-limit safety margin, matching the client's existing convention.
 */
const BATCH_SAFETY_LIMIT = 450;

/**
 * How far ahead an active recurring_series rule is kept materialized as real `sessions`
 * documents. Extended on a rolling basis by materializeRecurringWindows below, rather than
 * generating the rule's entire lifetime (which may be indefinite) up front.
 */
const WINDOW_WEEKS = 10;
const DEFAULT_TIMEZONE = 'Europe/Dublin';

/**
 * Builds a session document for a single recurring occurrence, given the exact (already
 * timezone-correct) UTC instant it should start at. Mirrors BookingModal.tsx's
 * getBookingData()/getSeriesData() shape.
 */
function buildSeriesSessionData({ startInstant, dayIdx, time, trainerId, trainerName, serviceId, serviceName,
    clientId, clientName, clientEmail, clientPhone, clientUid, bookingType, siteId, createdBy, seriesId, recurringDetails }) {

    const endInstant = new Date(startInstant.getTime() + 60 * 60 * 1000);

    const clientObj = bookingType === 'block'
        ? { id: 'blocked', name: 'Blocked', email: '', uid: 'blocked', phone: '' }
        : { id: clientId || null, name: clientName || 'Unknown Client', email: clientEmail || null, uid: clientUid || null, phone: clientPhone || null };

    return {
        clients: [clientObj],
        clientIds: [clientObj.id].filter(Boolean),
        clientName: clientObj.name,
        clientPhone: clientObj.phone || null,
        trainerName,
        trainerId: trainerId || null,
        serviceName: bookingType === 'block' ? 'Blocked Slot' : serviceName,
        serviceId: bookingType === 'block' ? 'blocked' : (serviceId || null),
        startTime: admin.firestore.Timestamp.fromDate(startInstant),
        endTime: admin.firestore.Timestamp.fromDate(endInstant),
        time,
        day: dayIdx,
        date: startInstant.toISOString(),
        status: bookingType === 'block' ? 'Blocked' : 'Scheduled',
        siteId,
        seriesId,
        recurringDetails,
        createdAt: new Date().toISOString(),
        createdBy: createdBy || 'Unknown User',
        busySlotSynced: true
    };
}

function parseTimeToHM(time) {
    const [timePart, modifier] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
}

/**
 * Enumerates occurrence instants (as UTC-instant JS Dates) for a recurring_series rule between
 * fromDate and toDate (both plain JS Dates), computed timezone-aware via luxon so a rule's wall-
 * clock time (e.g. "9am Dublin") stays correct across DST transitions — this runs unattended,
 * indefinitely, with no human reviewing the output, unlike the old synchronous booking flow.
 */
function enumerateOccurrenceDates(rule, fromDate, toDate) {
    const zone = rule.timezone || DEFAULT_TIMEZONE;
    const { hours, minutes } = parseTimeToHM(rule.time);

    const ruleStart = DateTime.fromISO(rule.startDate, { zone });
    const windowStartRaw = DateTime.fromJSDate(fromDate, { zone });
    let windowStart = windowStartRaw > ruleStart ? windowStartRaw : ruleStart;
    windowStart = windowStart.startOf('day');

    const windowEnd = DateTime.fromJSDate(toDate, { zone });
    const ruleEnd = rule.endDate ? DateTime.fromISO(rule.endDate, { zone }) : null;
    const effectiveEnd = ruleEnd && ruleEnd < windowEnd ? ruleEnd : windowEnd;

    const dates = [];

    if (rule.frequency === 'daily') {
        let cursor = windowStart;
        while (cursor <= effectiveEnd) {
            dates.push(cursor.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 }).toJSDate());
            cursor = cursor.plus({ days: 1 });
        }
    } else {
        for (const dayIdx of rule.days) {
            const targetWeekday = dayIdx + 1; // our Mon=0..Sun=6 -> luxon Mon=1..Sun=7
            let cursor = windowStart;
            let diff = targetWeekday - cursor.weekday;
            if (diff < 0) diff += 7;
            cursor = cursor.plus({ days: diff });

            while (cursor <= effectiveEnd) {
                dates.push(cursor.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 }).toJSDate());
                cursor = cursor.plus({ weeks: 1 });
            }
        }
    }

    return dates.sort((a, b) => a - b);
}

async function getServiceMaxCapacity(serviceId) {
    if (!serviceId) return 1;
    const snap = await db.collection('services').doc(serviceId).get();
    return snap.exists ? (snap.data().max_capacity || 1) : 1;
}

/**
 * Materializes concrete `sessions` documents for a recurring_series rule, for occurrences
 * between fromDate and toDate. Shared by createRecurringSeries (initial window),
 * materializeRecurringWindows (the daily scheduled extension job), updateRecurringSeriesFuture
 * and addClientToRecurringSeries (both create a sibling rule and materialize its window) — one
 * function, so create-or-append-if-room behavior can't drift between call sites the way it did
 * before (the old updateRecurringSeriesFuture had no existing-session check at all, unlike the
 * old createRecurringSeries — a latent duplicate-booking bug, fixed here by consolidation).
 *
 * Each occurrence is checked-and-written inside its own Firestore transaction rather than a
 * shared batch — the rolling window is small (tens of documents, not hundreds), so this is cheap,
 * and it closes the race where two near-simultaneous requests could both see a slot as free and
 * both write to it.
 */
async function materializeRuleWindow(rule, seriesId, fromDate, toDate) {
    // Defense-in-depth: the trainers/{id} onUpdate trigger cancels a trainer's active rules the
    // moment they're deactivated, but this scheduled job can lag up to one run behind that (it
    // re-queries status:'active' fresh every run) — without this check, a rule could still get
    // extended once during that window. This also guards against a rule staying active for a
    // trainer through any other path (manual Firestore edit, a bug), since it doesn't depend on
    // the trigger having fired at all. Missing status is treated as Active, matching the
    // fallback convention already used client-side (EditTrainerModal, TrainerProfile).
    if (rule.trainerId) {
        const trainerSnap = await db.collection('trainers').doc(rule.trainerId).get();
        if (!trainerSnap.exists || trainerSnap.data().status === 'Inactive') {
            return {
                created: 0, appended: 0, skippedDates: [],
                materializedThrough: rule.materializedThrough ? new Date(rule.materializedThrough) : fromDate
            };
        }
    }

    const exceptionsSet = new Set(rule.exceptions || []);
    const maxCapacity = await getServiceMaxCapacity(rule.serviceId);
    const occurrenceDates = enumerateOccurrenceDates(rule, fromDate, toDate);
    const zone = rule.timezone || DEFAULT_TIMEZONE;

    let created = 0;
    let appended = 0;
    const newSkips = [];
    let materializedThrough = rule.materializedThrough ? new Date(rule.materializedThrough) : fromDate;

    for (const occInstant of occurrenceDates) {
        const occDateTime = DateTime.fromJSDate(occInstant, { zone });
        const dateKey = occDateTime.toISODate();
        if (exceptionsSet.has(dateKey)) continue;

        const dayIdx = (occDateTime.weekday - 1 + 7) % 7;
        const sessionData = buildSeriesSessionData({
            startInstant: occInstant, dayIdx, time: rule.time, trainerId: rule.trainerId, trainerName: rule.trainerName,
            serviceId: rule.serviceId, serviceName: rule.serviceName, clientId: rule.clientId, clientName: rule.clientName,
            clientEmail: rule.clientEmail, clientPhone: rule.clientPhone, clientUid: rule.clientUid,
            bookingType: rule.bookingType, siteId: rule.siteId, createdBy: rule.createdBy, seriesId, recurringDetails: rule.recurringDetails
        });

        const outcome = await db.runTransaction(async (t) => {
            const existingSnap = await t.get(
                db.collection('sessions')
                    .where('trainerId', '==', rule.trainerId)
                    .where('siteId', '==', rule.siteId)
                    .where('date', '==', sessionData.date)
                    .where('time', '==', rule.time)
                    .limit(1)
            );

            if (!existingSnap.empty) {
                const existingDoc = existingSnap.docs[0];
                const existing = existingDoc.data();
                if (existing.serviceName === rule.serviceName && (existing.clients?.length || 0) < maxCapacity) {
                    if (existing.clients?.some(c => c.id === rule.clientId)) {
                        return { type: 'noop' };
                    }
                    const clientObj = { id: rule.clientId || null, name: rule.clientName || 'Unknown Client', email: rule.clientEmail || null, uid: rule.clientUid || null, phone: rule.clientPhone || null };
                    const newClients = [...(existing.clients || []), clientObj];
                    const newClientIds = Array.from(new Set(newClients.map(c => c.id))).filter(Boolean);
                    t.update(existingDoc.ref, { clients: newClients, clientIds: newClientIds });
                    return { type: 'appended' };
                }
                return { type: 'skipped' };
            }

            const sessionRef = db.collection('sessions').doc();
            t.set(sessionRef, sessionData);
            t.set(db.collection('trainer_busy_slots').doc(sessionRef.id), {
                trainerId: sessionData.trainerId,
                date: sessionData.date,
                time: sessionData.time,
                siteId: sessionData.siteId
            });
            return { type: 'created' };
        });

        if (outcome.type === 'created') created++;
        else if (outcome.type === 'appended') appended++;
        else if (outcome.type === 'skipped') newSkips.push(dateKey);

        if (occInstant > materializedThrough) materializedThrough = occInstant;
    }

    return { created, appended, skippedDates: newSkips, materializedThrough };
}

/** Deletes materialized sessions/trainer_busy_slots for a series from fromDateISO onward. */
async function trimRuleFrom(seriesId, siteId, fromDateISO) {
    const snap = await db.collection('sessions')
        .where('seriesId', '==', seriesId)
        .where('date', '>=', fromDateISO)
        .where('siteId', '==', siteId)
        .get();

    let batch = db.batch();
    let opCount = 0;
    for (const docSnap of snap.docs) {
        batch.delete(docSnap.ref);
        batch.delete(db.collection('trainer_busy_slots').doc(docSnap.id));
        opCount += 2;
        if (opCount >= BATCH_SAFETY_LIMIT) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    }
    if (opCount > 0) await batch.commit();
    return snap.size;
}

/** Materializes a rule's rolling window and persists materializedThrough/skippedDates. */
async function materializeAndPersist(rule, seriesId) {
    const fromDate = new Date(rule.materializedThrough || rule.startDate);
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + WINDOW_WEEKS * 7);
    const toDate = rule.endDate && new Date(rule.endDate) < windowEnd ? new Date(rule.endDate) : windowEnd;

    const result = await materializeRuleWindow(rule, seriesId, fromDate, toDate);

    const updatePayload = { materializedThrough: result.materializedThrough.toISOString() };
    if (result.skippedDates.length > 0) {
        updatePayload.skippedDates = admin.firestore.FieldValue.arrayUnion(...result.skippedDates);
    }
    await db.collection('recurring_series').doc(seriesId).update(updatePayload);

    return result;
}

/**
 * createRecurringSeries: Creates a recurring_series rule document and materializes its first
 * rolling window (WINDOW_WEEKS ahead, or the rule's endDate if sooner). Staff bookings may pass
 * endDateISO: null for a true indefinite rule (no more "2 years" as a stand-in for "forever") —
 * client bookings continue to pass their existing 14-day cap, which naturally fits inside one
 * window so no scheduled extension is ever needed for them in practice.
 *
 * Replaces the old per-occurrence client-side writeBatch loop for this path, which independently
 * triggered onSessionWritten (a separate Cloud Function invocation) per document — up to ~300 for
 * a 2-year weekly series. This function does the equivalent work server-side, and (unlike before)
 * only ever materializes a bounded window regardless of how long the rule itself runs for.
 *
 * All validation (conflicts, capacity, tier restrictions, confirmation) already happens
 * client-side before this is called, exactly as before — this function performs the writes.
 */
exports.createRecurringSeries = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }

    const {
        siteId, time, startDateISO, days, frequency, endDateISO, timezone,
        trainerId, trainerName, serviceId, serviceName,
        clientId, clientName, clientEmail, clientPhone, clientUid,
        bookingType, createdBy, conflictKeysToSkip, seriesId, recurringDetails
    } = data;

    if (!time || !startDateISO || !Array.isArray(days) || days.length === 0 || !seriesId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    const zone = timezone || DEFAULT_TIMEZONE;
    // conflictKeysToSkip (from the client's pre-flight conflict-check UI) are "toDateString()|time"
    // formatted date-only keys; normalize into the rule's ISO-date exceptions format.
    const exceptions = (conflictKeysToSkip || []).map(key => {
        const [dateStr] = key.split('|');
        return DateTime.fromJSDate(new Date(dateStr), { zone }).toISODate();
    });

    const rule = {
        siteId, trainerId, trainerName, serviceId, serviceName,
        clientId, clientName, clientEmail, clientPhone, clientUid,
        bookingType: bookingType || 'client',
        time,
        days,
        frequency: frequency === 'daily' ? 'daily' : 'weekly',
        startDate: startDateISO,
        endDate: endDateISO || null,
        timezone: zone,
        exceptions,
        materializedThrough: startDateISO,
        skippedDates: [],
        status: 'active',
        recurringDetails,
        createdAt: new Date().toISOString(),
        createdBy: createdBy || 'Unknown User'
    };

    await db.collection('recurring_series').doc(seriesId).set(rule);
    const { created, appended, skippedDates } = await materializeAndPersist(rule, seriesId);

    await db.collection('activity_logs').add({
        action: 'booked',
        isRecurring: true,
        sessionDetails: { clientName, trainerName, serviceName, date: startDateISO, time, recurringDetails: recurringDetails || null },
        performedBy: { uid: context.auth.uid, name: createdBy || 'Unknown User', role: 'unknown' },
        timestamp: new Date().toISOString(),
        siteId
    });

    return { success: true, created, appended, skippedCount: skippedDates.length };
});

/**
 * updateRecurringSeriesFuture: "Editing" a series (days/time/frequency change from a chosen
 * occurrence forward) always retires the existing rule and creates a new sibling rule, rather
 * than mutating days/time in place — this collapses what were three divergent "edit a series"
 * code paths (this function, and SessionDetailModal's two future-scope flows) into one shared
 * "split rule at date, create new rule" primitive built on materializeAndPersist above.
 */
exports.updateRecurringSeriesFuture = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }

    const {
        siteId, seriesId, fromDateISO, time, startDateISO, days, frequency, endDateISO, timezone,
        trainerId, trainerName, serviceId, serviceName,
        clientId, clientName, clientEmail, clientPhone, clientUid, bookingType,
        recurringDetails, createdBy
    } = data;

    if (!seriesId || !fromDateISO || !time || !startDateISO || !Array.isArray(days) || days.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    // 1. Retire the old rule: end it the day before the edited occurrence, and trim its
    //    materialized docs from that point onward.
    const oldRuleRef = db.collection('recurring_series').doc(seriesId);
    const oldRuleSnap = await oldRuleRef.get();
    if (oldRuleSnap.exists) {
        const dayBefore = new Date(fromDateISO);
        dayBefore.setDate(dayBefore.getDate() - 1);
        await oldRuleRef.update({ endDate: dayBefore.toISOString() });
    }
    await trimRuleFrom(seriesId, siteId, fromDateISO);

    // 2. Create a new sibling rule for the new day/time selection, from the edited date forward.
    const newSeriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRule = {
        siteId, trainerId, trainerName, serviceId, serviceName,
        clientId, clientName, clientEmail, clientPhone, clientUid,
        bookingType: bookingType || 'client',
        time,
        days,
        frequency: frequency === 'daily' ? 'daily' : 'weekly',
        startDate: startDateISO,
        endDate: endDateISO || null,
        timezone: timezone || DEFAULT_TIMEZONE,
        exceptions: [],
        materializedThrough: startDateISO,
        skippedDates: [],
        status: 'active',
        recurringDetails,
        createdAt: new Date().toISOString(),
        createdBy: createdBy || 'Unknown User'
    };
    await db.collection('recurring_series').doc(newSeriesId).set(newRule);
    const { created, appended, skippedDates } = await materializeAndPersist(newRule, newSeriesId);

    await db.collection('activity_logs').add({
        action: 'rescheduled',
        isRecurring: true,
        sessionDetails: { clientName, trainerName, serviceName, date: startDateISO, time, recurringDetails: recurringDetails || null },
        performedBy: { uid: context.auth.uid, name: createdBy || 'Unknown User', role: 'unknown' },
        timestamp: new Date().toISOString(),
        siteId
    });

    return { success: true, created, appended, skippedCount: skippedDates.length, newSeriesId };
});

/**
 * addClientToRecurringSeries: Replaces SessionDetailModal's old "add client to future
 * occurrences" (which mutated another client's series' documents directly). Creates a new
 * sibling recurring_series rule for the added client — mirroring the target series' trainer/
 * time/end-date — and materializes it immediately. This is a real rule creation (a genuine
 * onSessionWritten `create` event for the new sessions), so the added client now receives a
 * WhatsApp confirmation, unlike before where the old update-based path sent nothing.
 */
exports.addClientToRecurringSeries = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }

    const {
        siteId, targetSeriesId, fromDateISO,
        clientId, clientName, clientEmail, clientPhone, clientUid,
        selectedDays, createdBy
    } = data;

    if (!targetSeriesId || !fromDateISO || !Array.isArray(selectedDays) || selectedDays.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    const targetRuleSnap = await db.collection('recurring_series').doc(targetSeriesId).get();
    if (!targetRuleSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Target series not found.');
    }
    const targetRule = targetRuleSnap.data();

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sortedDays = [...selectedDays].sort((a, b) => a - b);
    const recurringDetails = `Weekly on ${sortedDays.map(d => dayNames[d]).join(', ')}`;

    const newSeriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRule = {
        siteId: siteId || targetRule.siteId,
        trainerId: targetRule.trainerId, trainerName: targetRule.trainerName,
        serviceId: targetRule.serviceId, serviceName: targetRule.serviceName,
        clientId, clientName, clientEmail: clientEmail || null, clientPhone: clientPhone || null, clientUid: clientUid || null,
        bookingType: 'client',
        time: targetRule.time,
        days: selectedDays,
        frequency: 'weekly',
        startDate: fromDateISO,
        endDate: targetRule.endDate || null,
        timezone: targetRule.timezone || DEFAULT_TIMEZONE,
        exceptions: [],
        materializedThrough: fromDateISO,
        skippedDates: [],
        status: 'active',
        recurringDetails,
        createdAt: new Date().toISOString(),
        createdBy: createdBy || 'Unknown User'
    };

    await db.collection('recurring_series').doc(newSeriesId).set(newRule);
    const { created, appended, skippedDates } = await materializeAndPersist(newRule, newSeriesId);

    await db.collection('activity_logs').add({
        action: 'booked',
        isRecurring: true,
        sessionDetails: { clientName, trainerName: targetRule.trainerName, serviceName: targetRule.serviceName, date: fromDateISO, time: targetRule.time, recurringDetails },
        performedBy: { uid: context.auth.uid, name: createdBy || 'Unknown User', role: 'unknown' },
        timestamp: new Date().toISOString(),
        siteId: siteId || targetRule.siteId
    });

    return { success: true, created, appended, skippedCount: skippedDates.length, newSeriesId };
});

/**
 * deleteRecurringOccurrence: Deletes (or, for a multi-client session, detaches this client from)
 * a single occurrence, and atomically records the date in the rule's exceptions array in the same
 * transaction — so a scheduled materializeRecurringWindows run can't land in the gap between the
 * two writes and regenerate the just-deleted occurrence.
 */
exports.deleteRecurringOccurrence = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }

    const { sessionId, seriesId, dateISO, clientId, timezone } = data;
    if (!sessionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId.');
    }

    const sessionRef = db.collection('sessions').doc(sessionId);
    const ruleRef = seriesId ? db.collection('recurring_series').doc(seriesId) : null;

    // Explicit Intent Flag, written before the delete below: tells onSessionWritten this is a
    // single-occurrence cancellation (routes to the single-cancel notification), not a full
    // series cancellation (which would otherwise fire the once-per-series recurring-cancel
    // notification instead) — matches the original client-side behavior this replaces.
    if (seriesId) {
        await sessionRef.update({ deletionIntent: 'single' }).catch(() => {});
    }

    await db.runTransaction(async (t) => {
        const sessionSnap = await t.get(sessionRef);
        if (!sessionSnap.exists) return;
        const s = sessionSnap.data();

        if (clientId && Array.isArray(s.clients) && s.clients.length > 1) {
            const updatedClients = s.clients.filter(c => c.id !== clientId);
            const newClientIds = Array.from(new Set(updatedClients.map(c => c.id))).filter(Boolean);
            t.update(sessionRef, { clients: updatedClients, clientIds: newClientIds });
        } else {
            t.delete(sessionRef);
            t.delete(db.collection('trainer_busy_slots').doc(sessionId));
        }

        if (ruleRef && dateISO) {
            const dateKey = DateTime.fromISO(dateISO, { zone: timezone || DEFAULT_TIMEZONE }).toISODate();
            t.update(ruleRef, { exceptions: admin.firestore.FieldValue.arrayUnion(dateKey) });
        }
    });

    return { success: true };
});

/**
 * cancelRecurringSeriesFuture: Cancels this occurrence and all future occurrences of a series
 * (SessionDetailModal's deleteScope === 'future') — distinct from updateRecurringSeriesFuture,
 * which changes the days/time going forward; this just ends the commitment. Retires the rule
 * (endDate = day before fromDate, or status: 'cancelled' if fromDate is at/before the rule's
 * own start) and trims materialized docs from fromDate onward — bounded to the rolling window
 * a series ever has materialized, unlike the old unbounded `where('seriesId','==',...)` scan
 * this replaces. If clientId is provided and a future occurrence has other clients on it (a
 * shared/group session), only that client is removed rather than deleting the whole session.
 */
exports.cancelRecurringSeriesFuture = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }

    const { seriesId, siteId, fromDateISO, clientId } = data;
    if (!seriesId || !fromDateISO || !siteId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    const ruleRef = db.collection('recurring_series').doc(seriesId);
    const ruleSnap = await ruleRef.get();
    if (ruleSnap.exists) {
        const rule = ruleSnap.data();
        const dayBefore = new Date(fromDateISO);
        dayBefore.setDate(dayBefore.getDate() - 1);
        if (new Date(rule.startDate) >= new Date(fromDateISO)) {
            await ruleRef.update({ status: 'cancelled', endDate: dayBefore.toISOString() });
        } else {
            await ruleRef.update({ endDate: dayBefore.toISOString() });
        }
    }

    const snap = await db.collection('sessions')
        .where('seriesId', '==', seriesId)
        .where('date', '>=', fromDateISO)
        .where('siteId', '==', siteId)
        .get();

    let batch = db.batch();
    let opCount = 0;
    let affected = 0;
    const commitIfFull = async () => {
        if (opCount >= BATCH_SAFETY_LIMIT) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    };

    for (const docSnap of snap.docs) {
        const docData = docSnap.data();
        if (clientId && Array.isArray(docData.clients) && docData.clients.length > 1) {
            const updatedClients = docData.clients.filter(c => c.id !== clientId);
            if (updatedClients.length === 0) {
                batch.delete(docSnap.ref);
                batch.delete(db.collection('trainer_busy_slots').doc(docSnap.id));
                opCount += 2;
            } else {
                const newClientIds = Array.from(new Set(updatedClients.map(c => c.id))).filter(Boolean);
                batch.update(docSnap.ref, { clients: updatedClients, clientIds: newClientIds });
                opCount += 1;
            }
        } else {
            batch.delete(docSnap.ref);
            batch.delete(db.collection('trainer_busy_slots').doc(docSnap.id));
            opCount += 2;
        }
        affected++;
        await commitIfFull();
    }
    if (opCount > 0) await batch.commit();

    return { success: true, affected };
});

/**
 * materializeRecurringWindows: Daily scheduled extension of every active rule's rolling window.
 * Idempotent per rule (guarded by materializedThrough, not by "did this run today"), so retries
 * or duplicate invocations are safe. A rule that can't place an occurrence (conflict) has that
 * date recorded in skippedDates rather than silently dropped — this job runs unattended,
 * indefinitely, with no human reviewing its output, so a silent failure here would be permanent
 * and invisible, unlike the one-shot creation-time equivalent.
 */
exports.materializeRecurringWindows = functions.region('us-central1').pubsub.schedule('every 24 hours').onRun(async () => {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + WINDOW_WEEKS * 7 - 14); // extend once within 2 weeks of the window edge

    const activeSnap = await db.collection('recurring_series')
        .where('status', '==', 'active')
        .where('materializedThrough', '<=', threshold.toISOString())
        .get();

    console.log(`materializeRecurringWindows: ${activeSnap.size} rule(s) need extension`);

    for (const doc of activeSnap.docs) {
        const rule = doc.data();
        const seriesId = doc.id;

        if (rule.endDate && new Date(rule.endDate) < now) {
            // Rule has already ended — nothing left to extend; mark inactive for hygiene.
            await doc.ref.update({ status: 'cancelled' });
            continue;
        }

        try {
            await materializeAndPersist(rule, seriesId);
        } catch (err) {
            console.error(`materializeRecurringWindows: failed to extend ${seriesId}`, err);
        }
    }

    return null;
});

/**
 * onTrainerDeactivated: fires only on an explicit status transition Active -> Inactive on a
 * trainer doc (onUpdate, not onWrite, so ordinary name/phone/availability edits via
 * EditTrainerModal don't re-trigger this, and the create/delete cases don't apply). Cancels
 * every active recurring_series rule owned by that trainer — a rule silently continuing to book
 * an inactive trainer forever (materializeRecurringWindows never checked trainer existence) is
 * unambiguously wrong and needs no human judgment call, unlike what happens to the trainer's
 * already-materialized future sessions, which surface in the manager-facing resolution list
 * instead of being touched here.
 */
exports.onTrainerDeactivated = functions.region('us-central1').firestore
    .document('trainers/{trainerId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        if (before.status !== 'Active' || after.status !== 'Inactive') {
            return null;
        }

        const trainerId = context.params.trainerId;
        const rulesSnap = await db.collection('recurring_series')
            .where('trainerId', '==', trainerId)
            .where('status', '==', 'active')
            .get();

        if (rulesSnap.empty) return null;

        let batch = db.batch();
        let opCount = 0;
        for (const doc of rulesSnap.docs) {
            batch.update(doc.ref, { status: 'cancelled' });
            opCount++;
            if (opCount >= BATCH_SAFETY_LIMIT) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }
        if (opCount > 0) await batch.commit();

        const logBatch = db.batch();
        rulesSnap.docs.forEach(doc => {
            const rule = doc.data();
            logBatch.set(db.collection('activity_logs').doc(), {
                action: 'series_auto_cancelled_trainer_inactive',
                isRecurring: true,
                sessionDetails: {
                    clientName: rule.clientName, trainerName: rule.trainerName,
                    serviceName: rule.serviceName, recurringDetails: rule.recurringDetails || null
                },
                performedBy: { uid: 'system', role: 'system', name: 'Trainer Deactivation Cascade' },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                siteId: rule.siteId
            });
        });
        await logBatch.commit();

        console.log(`onTrainerDeactivated: cancelled ${rulesSnap.size} rule(s) for trainer ${trainerId}`);
        return null;
    });

/**
 * deleteTrainerIfNoHistory: the only path allowed to hard-delete a trainer doc now
 * (firestore.rules blocks direct client deletes). Only succeeds for a trainer with zero session
 * history ever — not just zero upcoming — since a trainer with completed past sessions still has
 * real history worth preserving (activity logs, reporting). Anyone with any history must go
 * through deactivation (a plain status update) instead.
 */
exports.deleteTrainerIfNoHistory = functions.region('us-central1').https.onCall(async (data, context) => {
    await requireManager(context);

    const { trainerId } = data;
    if (!trainerId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing trainerId.');
    }

    const [sessSnap, ruleSnap] = await Promise.all([
        db.collection('sessions').where('trainerId', '==', trainerId).limit(1).get(),
        db.collection('recurring_series').where('trainerId', '==', trainerId).limit(1).get()
    ]);

    if (!sessSnap.empty || !ruleSnap.empty) {
        throw new functions.https.HttpsError('failed-precondition', 'This trainer has session history and cannot be deleted — deactivate them instead.');
    }

    await db.collection('trainers').doc(trainerId).delete();
    return { success: true };
});

/**
 * bulkReassignSessions: reassigns every listed session to a new trainer in one call, for
 * resolving a deactivated trainer's upcoming-sessions backlog in bulk rather than one row at a
 * time (a single weekly recurring rule alone can leave ~WINDOW_WEEKS materialized occurrences,
 * and a busy trainer can have several concurrent rules). Clears seriesId on every reassigned
 * occurrence — required, not cosmetic: onSessionWritten's recurring branch only handles
 * isCreate/isDelete, so a session that keeps its seriesId after reassignment would fall through
 * to a silent no-op (no client notification) and would also leave materializeRuleWindow's
 * dedupe check unable to recognize the slot as covered, since it matches on the rule's own
 * trainerId — the next scheduled run would create a duplicate session for the original trainer.
 */
exports.bulkReassignSessions = functions.region('us-central1').https.onCall(async (data, context) => {
    await requireManager(context);

    const { sessionIds, newTrainerId, newTrainerName } = data;
    if (!Array.isArray(sessionIds) || sessionIds.length === 0 || !newTrainerId || !newTrainerName) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    let batch = db.batch();
    let opCount = 0;
    let reassigned = 0;

    for (const sessionId of sessionIds) {
        const ref = db.collection('sessions').doc(sessionId);
        batch.update(ref, {
            trainerId: newTrainerId,
            trainerName: newTrainerName,
            seriesId: admin.firestore.FieldValue.delete()
        });
        opCount++;
        reassigned++;
        if (opCount >= BATCH_SAFETY_LIMIT) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    }
    if (opCount > 0) await batch.commit();

    return { success: true, reassigned };
});
