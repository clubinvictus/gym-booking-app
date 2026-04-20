const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION ---
const targetEmail = 'trainers@clubinvictus.com';
// --- END CONFIGURATION ---

function initAdmin() {
    if (admin.apps.length) return;

    // Search for service account key in potential locations
    const keyPaths = [
        path.resolve(__dirname, './serviceAccountKey.json'),
        path.resolve(__dirname, '../serviceAccountKey.json'),
        path.resolve(__dirname, '../functions/serviceAccountKey.json')
    ];

    let initialized = false;
    for (const keyPath of keyPaths) {
        if (fs.existsSync(keyPath)) {
            admin.initializeApp({
                credential: admin.credential.cert(require(keyPath))
            });
            console.log(`ℹ️ Initialized with: ${keyPath}`);
            initialized = true;
            break;
        }
    }

    if (!initialized) {
        // Fallback to ADC - Explicitly targeting the project ID from your .env
        admin.initializeApp({
            projectId: 'gym-booking-app-bc602'
        });
        console.log('ℹ️ Initialized with Application Default Credentials');
    }
    
    const db = admin.firestore();
    console.log(`ℹ️ Project ID: ${admin.app().options.projectId}`);
}

async function purgeUser() {
    initAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

    try {
        console.log(`🚀 Starting thorough purge for user: ${targetEmail}`);

        // 1. Auth Purge & UID Resolution
        let uid = null;
        try {
            const userRecord = await auth.getUserByEmail(targetEmail);
            uid = userRecord.uid;
            await auth.deleteUser(uid);
            console.log(`✅ Auth record for ${targetEmail} (UID: ${uid}) has been deleted.`);
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                console.log(`ℹ️ Auth record for ${targetEmail} not found.`);
            } else {
                console.error(`❌ Error fetching Auth user: ${err.message}`);
            }
        }

        // 2. Client & User Profile Purge
        let clientId = null;
        const normalizedEmail = targetEmail.toLowerCase();
        
        // Search by email in both 'users' and 'clients'
        const collectionsToSearch = ['users', 'clients'];
        for (const coll of collectionsToSearch) {
            const snap = await db.collection(coll).where('email', '==', normalizedEmail).get();
            if (!snap.empty) {
                console.log(`🗑️ Found ${snap.size} documents in '${coll}' collection.`);
                for (const doc of snap.docs) {
                    if (coll === 'users' && !uid) uid = doc.id; // UID is often the doc ID in 'users'
                    if (coll === 'users' && doc.data().clientId) clientId = doc.data().clientId;
                    await doc.ref.delete();
                }
                console.log(`✅ Cleared '${coll}' documents.`);
            }
        }

        // 3. Fallback: Search by UID if doc IDs match UID
        if (uid) {
            const userRef = db.collection('users').doc(uid);
            const userSnap = await userRef.get();
            if (userSnap.exists) {
                if (!clientId) clientId = userSnap.data().clientId;
                await userRef.delete();
                console.log(`✅ Deleted user document by UID: ${uid}`);
            }
        }

        // 4. Session Purge: Use both clientId and UID (parallel support)
        const idsToScrub = Array.from(new Set([clientId, uid, targetEmail])).filter(Boolean);
        if (idsToScrub.length > 0) {
            const sessionSnap = await db.collection('sessions')
                .where('client_ids', 'array-contains-any', idsToScrub)
                .get();

            if (!sessionSnap.empty) {
                const batch = db.batch();
                sessionSnap.forEach(docSnap => batch.delete(docSnap.ref));
                await batch.commit();
                console.log(`✅ ${sessionSnap.size} session documents deleted.`);
            }
        }

        // 5. Activity Logs Purge
        const logSnap = await db.collection('activity_logs')
            .where('performedBy.uid', '==', uid)
            .get();
        if (!logSnap.empty) {
            const batch = db.batch();
            logSnap.forEach(docSnap => batch.delete(docSnap.ref));
            await batch.commit();
            console.log(`✅ ${logSnap.size} activity logs deleted.`);
        }

        console.log('🏁 Purge complete. Environment is now clean.');
        process.exit(0);
    } catch (err) {
        console.error(`❌ Purge process failed: ${err.message}`);
        process.exit(1);
    }
}

purgeUser();
