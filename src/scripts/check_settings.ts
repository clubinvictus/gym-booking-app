import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

const checkSettings = async () => {
    console.log('--- CHECKING SETTINGS COLLECTION ---');
    
    // Check all documents in settings
    const settingsRef = collection(db, 'settings');
    const snap = await getDocs(settingsRef);
    
    if (snap.empty) {
        console.log('The settings collection is completely empty.');
    } else {
        console.log('Documents found in settings collection:');
        snap.forEach(d => {
            console.log(`- ${d.id}`);
        });
    }

    // Attempt to read easysocial_webhooks directly
    console.log('\n--- CHECKING EASYSOCIAL_WEBHOOKS SPECIFICALLY ---');
    const webhookDoc = await getDoc(doc(db, 'settings', 'easysocial_webhooks'));
    
    if (webhookDoc.exists()) {
        console.log('✅ Document exists! Payload:');
        console.log(JSON.stringify(webhookDoc.data(), null, 2));
    } else {
        console.log('❌ Document easysocial_webhooks DOES NOT EXIST.');
    }
};

checkSettings().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
