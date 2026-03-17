const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'gym-booking-app-bc602' });
}
const db = admin.firestore();

async function checkBusySlots() {
    // Get a sample of busy slots
    const snapshot = await db.collection('trainer_busy_slots').limit(10).get();
    
    console.log('\n=== Sample trainer_busy_slots ===');
    if (snapshot.empty) {
        console.log('No busy slots found at all!');
    } else {
        console.log(`Total docs fetched: ${snapshot.size}`);
        snapshot.forEach(doc => {
            const d = doc.data();
            console.log(JSON.stringify({ id: doc.id, trainerId: d.trainerId, date: d.date, time: d.time, siteId: d.siteId }, null, 2));
        });
    }

    // Check sessions to compare format
    const sessionSnap = await db.collection('sessions').orderBy('timestamp', 'desc').limit(3).get();
    console.log('\n=== Latest sessions (for format comparison) ===');
    sessionSnap.forEach(doc => {
        const d = doc.data();
        console.log(JSON.stringify({ id: doc.id, day: d.day, time: d.time, date: d.date, trainerId: d.trainerId }, null, 2));
    });
}

checkBusySlots().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
