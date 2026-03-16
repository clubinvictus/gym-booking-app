const admin = require('firebase-admin');

// We have to point to the service account credentials to bypass the frontend Firebase Rules
// Make sure to download a valid gym-booking-app-bc602-firebase-adminsdk.json and reference it
const serviceAccountPath = './gym-booking-app-bc602-firebase-adminsdk-r4ndom.json';

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gym-booking-app-bc602.firebaseio.com"
  });
} catch (e) {
  // Fallback to default credentials if we are running in an environment with gcloud auth login
  console.log("No explicit service account found, falling back to application default credentials...");
  admin.initializeApp({ projectId: 'gym-booking-app-bc602' });
}

const db = admin.firestore();

async function setTrainerWebhook() {
    console.log('--- ADDING TRAINER WEBHOOK URL VIA ADMIN SDK ---');
    try {
        const docRef = db.doc('settings/easysocial_webhooks');
        
        // Use merge: true so we don't accidentally delete the working client ones
        await docRef.set({
            trainer_single_alert: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzQ2MCwiYSI6ImNtbW9kMG14dzVzZ3dyaXhwMmQzejM5NHQifQ=="
        }, { merge: true });

        console.log('✅ Successfully added trainer_single_alert URL.');
    } catch (e) {
        console.error('❌ Error updating document:', e);
        process.exit(1);
    }
}

setTrainerWebhook().then(() => process.exit(0));
