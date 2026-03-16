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

async function checkLatestSession() {
    console.log('--- CHECKING LATEST SESSION ---');
    try {
        const snapshot = await db.collection('sessions')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log('No sessions found.');
            return;
        }

        const doc = snapshot.docs[0];
        console.log(`Document ID: ${doc.id}`);
        const data = doc.data();
        console.log('Session Data:');
        console.log(JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('❌ Error fetching session:', e);
        process.exit(1);
    }
}

checkLatestSession().then(() => process.exit(0));
