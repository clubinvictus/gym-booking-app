import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
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

const checkLatestSession = async () => {
    console.log('Fetching most recent session...');
    const q = query(
        collection(db, 'sessions'),
        orderBy('timestamp', 'desc'),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log('No sessions found.');
        process.exit(0);
    }

    const session = snapshot.docs[0].data();
    console.log('\n--- LATEST SESSION RECORD ---');
    console.log(`ID: ${snapshot.docs[0].id}`);
    console.log(`Client Name: ${session.clientName}`);
    console.log(`Client Phone: '${session.clientPhone}'`);
    console.log(`Date: ${session.date}`);
    console.log(`Time: ${session.time}`);

    let to = session.clientPhone;
    if (!to || !to.startsWith('+')) {
        console.log(`\n❌ WARNING: Phone number does not start with '+'. Cloud Function will SKIP this!`);
    } else {
        console.log(`\n✅ Phone number starts with '+'. Cloud Function will process it.`);
        console.log(`Payload Phone Result (stripped): ${to.replace('+', '')}`);
    }
};

checkLatestSession().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
