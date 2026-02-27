import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
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

const cleanDilip = async () => {
    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, where('clientName', '==', 'Dilip Sinha'));
    const snapshot = await getDocs(q);

    let deletedCount = 0;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.createdAt) {
            const createdAtDate = new Date(data.createdAt);
            if (createdAtDate > yesterday) {
                console.log(`Deleting bugged session on ${data.date} at ${data.time} for Dilip Sinha...`);
                await deleteDoc(doc(db, 'sessions', docSnap.id));
                deletedCount++;
            }
        }
    }

    console.log(`Finished cleanup. Deleted ${deletedCount} sessions created in the last 24 hours for Dilip Sinha.`);
};

cleanDilip().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
