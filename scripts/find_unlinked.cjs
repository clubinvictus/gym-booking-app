const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (getApps().length === 0) {
    initializeApp({ projectId: 'gym-booking-app-bc602' });
}
const db = getFirestore();

async function findUnlinked() {
    const usersSnap = await db.collection('users').where('role', '==', 'client').get();
    console.log('Client users without clientId:');
    usersSnap.forEach(doc => {
        const data = doc.data();
        if (!data.clientId) {
            console.log(doc.id, '=>', data);
        }
    });
}
findUnlinked();
