import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import * as dotenv from 'dotenv';
import * as fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env', { encoding: 'utf8' }));

const firebaseConfig = {
    apiKey: envConfig.VITE_FIREBASE_API_KEY,
    authDomain: envConfig.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: envConfig.VITE_FIREBASE_PROJECT_ID,
    storageBucket: envConfig.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: envConfig.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFetch() {
    try {
        console.log('Testing trainers fetch...');
        // We simulate the useFirestore behavior
        const constraints = [];
        
        const q = query(
            collection(db, 'trainers'),
            where('siteId', '==', 'invictus-booking'),
            ...constraints
        );
        const snap = await getDocs(q);
        console.log(`Success! Found ${snap.size} trainers.`);

        snap.forEach(doc => {
            console.log(doc.data().name);
        });

    } catch (e: any) {
        console.error('Query Failed:', e.message);
    }
    process.exit(0);
}

testFetch();
