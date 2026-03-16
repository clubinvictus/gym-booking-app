const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'gym-booking-app-bc602' });
}
const db = admin.firestore();

async function checkLatestSession() {
    console.log('Fetching most recent session...');
    const snapshot = await db.collection('sessions')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.log('No sessions found.');
        process.exit(0);
    }

    const session = snapshot.docs[0].data();
    console.log('\n--- LATEST SESSION RECORD ---');
    console.log(`ID: ${snapshot.docs[0].id}`);
    console.log(`Client Name: ${session.clientName}`);
    console.log(`Client Phone: '${session.clientPhone}'`);
    console.log(`Date: ${session.date}`);
    console.log(`Time: ${session.time}`);

    // Simulating Cloud Function logic
    let to = session.clientPhone;
    if (!to || !to.startsWith('+')) {
        console.log(`\n❌ WARNING: Phone number does not start with '+'. Cloud Function will SKIP this!`);
    } else {
        console.log(`\n✅ Phone number starts with '+'. Cloud Function will process it: ${to}`);
        console.log(`Payload Phone Result (stripped): ${to.replace('+', '')}`);
    }
}

checkLatestSession().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
