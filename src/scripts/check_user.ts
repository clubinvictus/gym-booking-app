import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

const checkUser = async (uid: string) => {
    console.log(`Checking user: ${uid}`);
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
        console.log('User Data:', JSON.stringify(userSnap.data(), null, 2));
    } else {
        console.log('User NOT FOUND.');
    }
};

const uid = process.argv[2];
if (!uid) {
    console.error('Please provide a UID');
    process.exit(1);
}

checkUser(uid).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
