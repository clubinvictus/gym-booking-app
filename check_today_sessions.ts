import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
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

async function checkToday() {
    try {
        const q = query(collection(db, 'sessions'), where('siteId', '==', 'invictus-booking'));
        const snap = await getDocs(q);
        
        console.log(`Found ${snap.size} total sessions.`);
        let count = 0;
        snap.forEach(doc => {
            const data = doc.data();
            const d1 = data.date ? new Date(data.date) : null;
            const d2 = data.startTime && data.startTime.toDate ? data.startTime.toDate() : null;
            const finalD = d1 || d2;
            if (finalD && finalD.toDateString() === new Date().toDateString()) {
                console.log('Today session:', doc.id, 'date:', data.date, 'time:', data.time);
                count++;
            }
            if (finalD && finalD.toDateString() === 'Sat May 30 2026') {
                 // For debugging, in case new Date() is out of sync in the script vs the browser
            }
        });
        console.log(`Matched ${count} sessions for new Date().toDateString() == ${new Date().toDateString()}`);
    } catch (e: any) {
        console.error('Query Failed:', e.message);
    }
    process.exit(0);
}

checkToday();
