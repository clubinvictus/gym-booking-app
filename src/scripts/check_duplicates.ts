import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envFile = readFileSync(resolve(__dirname, '../../.env'), 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1]] = match[2].replace(/['"]/g, '').trim();
    }
});

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const checkDuplicates = async () => {
    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, where('clientName', '==', 'Dilip Sinha'));
    const snapshot = await getDocs(q);

    console.log(`Found ${snapshot.size} sessions.`);

    // Group by date and time
    const sessionMap = new Map();
    snapshot.forEach(doc => {
        const data = doc.data();
        const key = `${data.date}_${data.time}`;
        if (!sessionMap.has(key)) sessionMap.set(key, []);
        sessionMap.get(key).push({ id: doc.id, ...data });
    });

    let duplicateFound = false;
    for (const [key, sessions] of sessionMap.entries()) {
        if (sessions.length > 1) {
            duplicateFound = true;
            console.log(`\nDUPLICATES DETECTED FOR: ${key}`);
            sessions.forEach((s: any) => console.log(`  - ID: ${s.id} | SeriesID: ${s.seriesId}`));
        }
    }

    if (!duplicateFound) console.log("No duplicate records found in database. The issue is likely UI-side.");
};

checkDuplicates().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
