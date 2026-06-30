const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (getApps().length === 0) {
    initializeApp({ projectId: 'gym-booking-app-bc602' });
}
const db = getFirestore();

async function checkDouble() {
    const id1 = 'hkVWydbjlhyfTwzxW6nv';
    const id2 = 'QxZG7IIpJGh5pS4DACqWDeskrdz2';

    const snap1 = await db.collection('sessions').where('clientIds', 'array-contains', id1).get();
    console.log(`Sessions for ${id1}: ${snap1.size}`);

    const snap2 = await db.collection('sessions').where('clientIds', 'array-contains', id2).get();
    console.log(`Sessions for ${id2}: ${snap2.size}`);
}
checkDouble();
