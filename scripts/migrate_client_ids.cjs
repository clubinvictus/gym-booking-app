const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Initialize with Application Default Credentials
if (getApps().length === 0) {
    initializeApp({
        projectId: 'gym-booking-app-bc602'
    });
}

const db = getFirestore();

async function migrateClientIds() {
    console.log('🚀 Starting migration of client IDs...');
    
    try {
        const sessionsSnapshot = await db.collection('sessions').get();
        let updateCount = 0;
        let skippedCount = 0;

        let batch = db.batch();
        let batchSize = 0;

        for (const sessionDoc of sessionsSnapshot.docs) {
            const data = sessionDoc.data();
            
            // Gather all possible client ID fields
            const allClientIds = new Set();
            
            if (Array.isArray(data.clientIds)) data.clientIds.forEach(id => { if (id) allClientIds.add(id); });
            if (Array.isArray(data.client_ids)) data.client_ids.forEach(id => { if (id) allClientIds.add(id); });
            if (data.clientId) allClientIds.add(data.clientId);
            
            // We do NOT pull from 'uids' because 'uids' are auth IDs, not client doc IDs. 
            // We want clientIds to strictly be client document IDs.
            
            const consolidatedClientIds = Array.from(allClientIds);

            // Check if we need to update
            const needsUpdate = 
                JSON.stringify(data.clientIds) !== JSON.stringify(consolidatedClientIds) ||
                data.client_ids !== undefined ||
                data.clientId !== undefined ||
                data.uids !== undefined;

            if (needsUpdate) {
                // Update to canonical clientIds, and delete the legacy fields using admin.firestore.FieldValue.delete()
                batch.update(sessionDoc.ref, { 
                    clientIds: consolidatedClientIds,
                    client_ids: FieldValue.delete(),
                    clientId: FieldValue.delete(),
                    uids: FieldValue.delete()
                });
                batchSize++;
                updateCount++;
                
                // Commit batches of 400 (limit is 500)
                if (batchSize >= 400) {
                    await batch.commit();
                    console.log(`✅ Committed batch of ${batchSize} updates.`);
                    batch = db.batch();
                    batchSize = 0;
                }
            } else {
                skippedCount++;
            }
        }

        // Commit any remaining
        if (batchSize > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch of ${batchSize} updates.`);
        }

        console.log(`\n🎉 Migration complete!`);
        console.log(`Updated ${updateCount} sessions.`);
        console.log(`Skipped ${skippedCount} sessions (already clean).`);
        
    } catch (err) {
        console.error('❌ Migration failed:', err);
    }
}

migrateClientIds();
