const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

if (getApps().length === 0) {
    initializeApp({ projectId: 'gym-booking-app-bc602' });
}
const db = getFirestore();
const auth = getAuth();

async function fixClient() {
    const clientId = 'hkVWydbjlhyfTwzxW6nv';
    const email = 'Karithi.sella@gmail.com';
    const phoneNum = '8939627673';

    try {
        let authUser;
        try {
            // Try to find auth user by exact email
            authUser = await auth.getUserByEmail(email);
            console.log('Found Auth user by exact email:', authUser.uid);
        } catch (e) {
            try {
                // Try lowercase email
                authUser = await auth.getUserByEmail(email.toLowerCase());
                console.log('Found Auth user by lowercase email:', authUser.uid);
            } catch(e2) {
                try {
                    // Try phone
                    authUser = await auth.getUserByPhoneNumber('+91' + phoneNum);
                    console.log('Found Auth user by phone:', authUser.uid);
                } catch(e3) {
                    console.log('Could not find Auth user by email or phone. They might not have created an account yet.');
                    return;
                }
            }
        }

        if (authUser) {
            const userRef = db.collection('users').doc(authUser.uid);
            await userRef.set({
                email: authUser.email || email,
                name: authUser.displayName || 'Krithiga S',
                role: 'client',
                clientId: clientId,
                siteId: 'invictus-booking'
            }, { merge: true });

            console.log('Successfully linked Auth UID', authUser.uid, 'to Client ID', clientId);
        }

    } catch (err) {
        console.error('Error fixing client:', err);
    }
}
fixClient();
