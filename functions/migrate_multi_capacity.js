const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'gym-booking-app-bc602' });
const db = admin.firestore();

async function migrateMultiCapacity() {
    console.log('--- STARTING MULTI-CAPACITY MIGRATION ---');
    
    // 1. Migrate Services (Set max_capacity: 1)
    const servicesSnap = await db.collection('services').get();
    const serviceBatch = db.batch();
    let serviceCount = 0;
    
    servicesSnap.forEach(doc => {
        const data = doc.data();
        if (data.max_capacity === undefined) {
            serviceBatch.update(doc.ref, { max_capacity: 1 });
            serviceCount++;
        }
    });
    
    if (serviceCount > 0) {
        await serviceBatch.commit();
        console.log(`Updated ${serviceCount} services with max_capacity: 1`);
    }

    // 2. Migrate Sessions (Convert clientId/clientName to clients array)
    const sessionsSnap = await db.collection('sessions').get();
    let sessionCount = 0;
    let batch = db.batch();
    let opCount = 0;

    for (const doc of sessionsSnap.docs) {
        const data = doc.data();
        if (data.clientId && !data.clients) {
            const clients = [{
                id: data.clientId,
                name: data.clientName || 'Unknown Client'
            }];
            
            batch.update(doc.ref, { 
                clients: clients,
                // We keep old fields for backward compatibility during transition
                // but eventually they can be removed.
            });
            
            opCount++;
            sessionCount++;

            if (opCount >= 450) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }
    }

    if (opCount > 0) {
        await batch.commit();
    }
    
    console.log(`Updated ${sessionCount} sessions with clients array`);
    console.log('✅ Migration completed successfully.');
}

migrateMultiCapacity().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
