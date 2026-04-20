const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'gym-booking-app-bc602'
    });
}

const db = admin.firestore();

async function checkSession() {
    const email = 'trainers@clubinvictus.com'; // Test user email
    console.log(`🔍 Checking sessions for ${email}...`);
    
    // 1. Find the client document
    const clientsSnapshot = await db.collection('clients').where('email', '==', email).get();
    if (clientsSnapshot.empty) {
        console.log('❌ No client found with that email.');
        return;
    }
    
    const clientDoc = clientsSnapshot.docs[0];
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    console.log(`✅ Client found: ${clientId} (UID: ${clientData.uid})`);

    // 2. Find sessions
    const sessionsSnapshot = await db.collection('sessions')
        .where('client_ids', 'array-contains', clientId)
        .get();
        
    if (sessionsSnapshot.empty) {
        console.log('❌ No sessions found for this client ID.');
    } else {
        console.log(`📈 Found ${sessionsSnapshot.size} sessions:`);
        sessionsSnapshot.forEach(doc => {
            const s = doc.data();
            console.log(`- ID: ${doc.id}`);
            console.log(`  Status: ${s.status}`);
            console.log(`  Date/Time: ${s.date} at ${s.time}`);
            console.log(`  UIDs Array: ${JSON.stringify(s.uids)}`);
            console.log(`  EndTime: ${s.endTime?.toDate ? s.endTime.toDate().toISOString() : s.endTime}`);
        });
    }
}

checkSession();
