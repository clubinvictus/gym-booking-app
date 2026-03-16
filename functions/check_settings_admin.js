const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'gym-booking-app-bc602' });
const db = admin.firestore();

async function checkWebhookSettings() {
    console.log('--- FETCHING EASYSOCIAL_WEBHOOKS FROM FIRESTORE ADMIN ---');
    try {
        const docRef = db.doc('settings/easysocial_webhooks');
        const snap = await docRef.get();
        if (snap.exists) {
            console.log('✅ Document exists!');
            console.log('Document Data:');
            console.log(JSON.stringify(snap.data(), null, 2));
        } else {
            console.log('❌ Document DOES NOT EXIST!');
            
            // Re-create it just in case
            console.log('\nRe-creating document now...');
            await docRef.set({
                client_single_confirm: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzM5NiwiYSI6ImNtbWs4aTVpMzAzdXZ3aXhwaGRsYzhkcHYifQ=="
            }, { merge: true });
            console.log('Document re-created successfully.');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

checkWebhookSettings().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
