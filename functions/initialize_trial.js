const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I'll check if this exists or use default

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function initializeTrialService() {
    console.log('Initializing Trial Service...');
    
    // 1. Get a trainer ID
    const trainersSnap = await db.collection('trainers').limit(1).get();
    if (trainersSnap.empty) {
        console.error('No trainers found. Cannot initialize Trial service.');
        return;
    }
    const trainerId = trainersSnap.docs[0].id;
    const trainerName = trainersSnap.docs[0].data().name;
    console.log(`Using trainer: ${trainerName} (${trainerId})`);

    // 2. Check for existing Trial service
    const servicesRef = db.collection('services');
    const trialQ = await servicesRef.where('name', '==', 'Trial').get();

    const serviceData = {
        name: 'Trial',
        duration: 60,
        color: '#000000',
        max_capacity: 1,
        allowed_tiers: ['lead'],
        assignedTrainerIds: [trainerId],
        siteId: 'default' // Or fetch current siteId
    };

    if (!trialQ.empty) {
        console.log('Updating existing Trial service...');
        await trialQ.docs[0].ref.update(serviceData);
    } else {
        console.log('Creating new Trial service...');
        await servicesRef.add(serviceData);
    }

    console.log('Trial Service initialized successfully.');
}

initializeTrialService().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
