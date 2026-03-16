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

const appendTrainerWebhook = async () => {
    console.log('--- ADDING TRAINER WEBHOOK URL TO SETTINGS ---');
    try {
        const webhookDocRef = doc(db, 'settings', 'easysocial_webhooks');
        
        // We are using setDoc with merge: true to avoid overwriting the existing client webhook
        await setDoc(webhookDocRef, {
            trainer_single_alert: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzM5NiwiYSI6ImNtbWs4aTVpMzAzdXZ3aXhwaGRsYzhkcHYifQ==" // Using the same URL for now to prove it routes correctly, user will change this later
        }, { merge: true });

        console.log('✅ Successfully added trainer_single_alert to Firestore settings.');
    } catch (error) {
        console.error('❌ Failed to update settings:', error);
        process.exit(1);
    }
};

appendTrainerWebhook().then(() => process.exit(0));
