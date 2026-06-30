const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (getApps().length === 0) {
    initializeApp({ projectId: 'gym-booking-app-bc602' });
}
const db = getFirestore();

async function dumpUsers() {
    const usersSnap = await db.collection('users').get();
    console.log('ALL Users:');
    usersSnap.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
    });
}
dumpUsers();
