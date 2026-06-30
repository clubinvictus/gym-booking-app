const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (getApps().length === 0) {
    initializeApp({ projectId: 'gym-booking-app-bc602' });
}
const db = getFirestore();

async function mergeClient() {
    const wrongClientId = 'QxZG7IIpJGh5pS4DACqWDeskrdz2'; // User logged in as this
    const correctClientId = 'hkVWydbjlhyfTwzxW6nv'; // Admin sees this (311 sessions)

    try {
        // 1. Update the 'users' document to point to the correct client ID
        const userRef = db.collection('users').doc(wrongClientId); // Since Auth UID == wrongClientId
        await userRef.update({
            clientId: correctClientId,
            email: 'Karithi.sella@gmail.com' // Optional: Update to match the admin profile
        });
        console.log(`Updated user ${wrongClientId} to point to clientId ${correctClientId}`);

        // 2. Migrate the 4 sessions from wrongClientId to correctClientId
        const sessionsSnap = await db.collection('sessions').where('clientIds', 'array-contains', wrongClientId).get();
        
        let count = 0;
        const batch = db.batch();
        sessionsSnap.forEach(doc => {
            const data = doc.data();
            
            // Remove wrongClientId and add correctClientId
            let updatedClientIds = (data.clientIds || []).filter(id => id !== wrongClientId);
            if (!updatedClientIds.includes(correctClientId)) {
                updatedClientIds.push(correctClientId);
            }

            // Also update the 'clients' array if it exists
            let updatedClients = data.clients || [];
            let needsClientsUpdate = false;
            for (let i = 0; i < updatedClients.length; i++) {
                if (updatedClients[i].id === wrongClientId) {
                    updatedClients[i].id = correctClientId;
                    updatedClients[i].email = 'Karithi.sella@gmail.com';
                    needsClientsUpdate = true;
                }
            }

            const updates = { clientIds: updatedClientIds };
            if (needsClientsUpdate) updates.clients = updatedClients;
            
            batch.update(doc.ref, updates);
            count++;
        });

        if (count > 0) {
            await batch.commit();
            console.log(`Migrated ${count} sessions from wrong client ID to correct client ID.`);
        }

        console.log('Merge complete. She should now see all 315 sessions when she logs in.');

    } catch (err) {
        console.error('Error merging client:', err);
    }
}
mergeClient();
