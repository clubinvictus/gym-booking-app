const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (getApps().length === 0) {
    initializeApp({ projectId: 'gym-booking-app-bc602' });
}
const db = getFirestore();

async function check() {
    const id = 'hkVWydbjlhyfTwzxW6nv';
    const clientSnap = await db.collection('clients').doc(id).get();
    console.log('Is Client Doc?', clientSnap.exists);
    if (clientSnap.exists) {
        console.log('Client Data:', clientSnap.data());
    }

    const usersSnap3 = await db.collection('users').where('clientId', '==', id).get();
    console.log('\nUsers with clientId =', id, ':');
    usersSnap3.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
    });
}
check();
