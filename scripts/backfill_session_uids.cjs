const admin = require('firebase-admin');

// Initialize with Application Default Credentials
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'gym-booking-app-bc602'
    });
}

const db = admin.firestore();

async function backfillSessionUids() {
    console.log('🚀 Starting backfill of session UIDs...');
    
    try {
        // 1. Get all clients who have a linked UID
        const clientsSnapshot = await db.collection('clients').where('uid', '!=', null).get();
        const clientUidMap = new Map();
        
        clientsSnapshot.forEach(doc => {
            clientUidMap.set(doc.id, doc.data().uid);
        });
        
        console.log(`ℹ️ Found ${clientUidMap.size} clients with linked Auth UIDs.`);

        // 2. Get all sessions
        const sessionsSnapshot = await db.collection('sessions').get();
        let updateCount = 0;
        let skippedCount = 0;

        const batch = db.batch();
        let batchSize = 0;

        for (const sessionDoc of sessionsSnapshot.docs) {
            const data = sessionDoc.data();
            const clientIds = data.client_ids || data.clientIds || [];
            
            // Determine the UIDs that should be in this session
            const uids = [];
            clientIds.forEach(id => {
                const uid = clientUidMap.get(id);
                if (uid) uids.push(uid);
            });

            // Only update if we found UIDs and they aren't already there (or mismatched)
            if (uids.length > 0 && JSON.stringify(data.uids) !== JSON.stringify(uids)) {
                batch.update(sessionDoc.ref, { uids: uids });
                batchSize++;
                updateCount++;
                
                // Commit batches of 500
                if (batchSize === 500) {
                    await batch.commit();
                    batchSize = 0;
                }
            } else {
                skippedCount++;
            }
        }

        if (batchSize > 0) {
            await batch.commit();
        }

        console.log(`✅ Backfill complete!`);
        console.log(`📈 Updated: ${updateCount} sessions`);
        console.log(`⏭️ Skipped: ${skippedCount} sessions (already up to date or no UID link)`);

    } catch (error) {
        console.error('❌ Backfill failed:', error);
    }
}

backfillSessionUids();
