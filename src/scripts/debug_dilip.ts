import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, query, where, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Very simple .env parser
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

const debugDilip = async () => {
    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, where('clientName', '==', 'Dilip Sinha'), limit(5));
    const snapshot = await getDocs(q);

    console.log(`Found ${snapshot.size} sessions for Dilip. Inspecting first 5:`);
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        console.log(`\nSession ID: ${docSnap.id}`);
        console.log(`Date String: ${data.date}`);
        console.log(`Time: ${data.time}`);
        console.log(`CreatedAt: ${data.createdAt}`);
        console.log(`Series ID: ${data.seriesId || 'None'}`);
    });
};

debugDilip().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
