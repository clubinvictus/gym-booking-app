import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as dotenv from 'dotenv';
dotenv.config();

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

async function testFetch() {
    try {
        await signInWithEmailAndPassword(auth, 'marc.devaney@icloud.com', '123456');
        console.log('Logged in as', auth.currentUser?.uid);
        
        try {
            console.log('Testing trainers fetch...');
            const q = query(collection(db, 'trainers'), where('siteId', '==', 'invictus-booking'));
            const snap = await getDocs(q);
            console.log(`Success! Found ${snap.size} trainers.`);
        } catch (e: any) {
            console.error('Query Failed:', e.message);
        }
        
    } catch (e: any) {
        console.error('Login Failed:', e.message);
    }
    process.exit(0);
}

testFetch();
