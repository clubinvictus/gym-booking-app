const admin = require('firebase-admin');
const axios = require('axios');
const qs = require('qs');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'gym-booking-app-bc602'
    });
}

const db = admin.firestore();

async function pingManagerWebhook() {
    console.log('Reading webhook settings from Firestore...');
    const settingsSnap = await db.collection('settings').doc('easysocial_webhooks').get();
    
    if (!settingsSnap.exists) {
        console.error('Error: settings/easysocial_webhooks document not found.');
        process.exit(1);
    }

    const { manager_single_alert } = settingsSnap.data();
    
    if (!manager_single_alert) {
        console.error('Error: manager_single_alert field not found in Firestore.');
        process.exit(1);
    }

    console.log(`Found Webhook URL: ${manager_single_alert}`);
    
    const testData = {
        phone: '910000000000', // Dummy phone for detection
        template: 'manager_single_alert',
        clientName: 'Test Client',
        trainerName: 'Test Trainer',
        date: 'Sat, Mar 14, 2026',
        time: '10:00 AM'
    };

    console.log('Sending test payload to EasySocial...');
    try {
        const response = await axios.post(manager_single_alert, qs.stringify(testData), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('✅ Success! EasySocial received the ping.');
        console.log(`Response Status: ${response.status}`);
    } catch (error) {
        console.error('❌ Failed to ping webhook:', error.response?.data || error.message);
    }
}

pingManagerWebhook().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
