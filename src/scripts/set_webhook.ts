import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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

const setWebhook = async () => {
    const docRef = doc(db, 'settings', 'easysocial_webhooks');
    await setDoc(docRef, {
        client_single_confirm: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzM5NiwiYSI6ImNtbWs4aTVpMzAzdXZ3aXhwaGRsYzhkcHYifQ==",
        manager_single_alert: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzQ2MSwiYSI6ImNtbW9lMjlmMDV6NW9yaXhwM3dlcThvYWEifQ=="
    }, { merge: true });
    console.log("Webhook successfully added to Firestore!");
};

setWebhook().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
