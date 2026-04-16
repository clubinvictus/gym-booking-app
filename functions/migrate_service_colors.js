const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'gym-booking-app-bc602' });
const db = admin.firestore();

async function migrateServiceColors() {
    console.log('--- STARTING SERVICE COLOR MIGRATION ---');
    try {
        const servicesSnap = await db.collection('services').get();
        if (servicesSnap.empty) {
            console.log('No services found.');
            return;
        }

        let updatedCount = 0;
        const batch = db.batch();

        servicesSnap.forEach(doc => {
            const data = doc.data();
            if (!data.color) {
                batch.update(doc.ref, { color: '#000000' });
                console.log(`Will update service "${data.name}" with default color #000000`);
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            console.log(`Committing updates for ${updatedCount} services...`);
            await batch.commit();
            console.log('✅ Migration completed successfully.');
        } else {
            console.log('All services already have colors assigned. No changes needed.');
        }
    } catch (e) {
        console.error('Error during migration:', e);
    }
}

migrateServiceColors().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
