const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, writeBatch, doc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function testPermission() {
    try {
        await signInWithEmailAndPassword(auth, 'marc.devaney@icloud.com', '123456');
        console.log('Logged in as', auth.currentUser?.uid);
        
        // 1. Test trainer_busy_slots
        try {
            console.log('Testing trainer_busy_slots read...');
            const snap = await getDocs(query(collection(db, 'trainer_busy_slots')));
            console.log('trainer_busy_slots success =', snap.size);
        } catch (e) {
            console.error('trainer_busy_slots failed:', e.message);
        }

        // 2. Test sessions query by trainerId (what happens if isClient is falsely evaluated)
        try {
            console.log('Testing sessions query by trainerId...');
            const snap2 = await getDocs(query(collection(db, 'sessions'), where('trainerId', '==', 'someTrainerId')));
            console.log('sessions query success =', snap2.size);
        } catch (e) {
            console.error('sessions query failed:', e.message);
        }

    } catch (e) {
        console.error('Fatal Error:', e.message);
    }
    process.exit(0);
}

testPermission();
