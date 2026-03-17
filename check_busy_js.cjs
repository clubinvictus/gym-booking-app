const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'gym-booking-app-bc602'
  });
}

const db = admin.firestore();
const SITE_ID = 'invictus-booking';

async function checkData() {
  console.log('Checking trainer_busy_slots...');
  const busySnap = await db.collection('trainer_busy_slots')
    .where('siteId', '==', SITE_ID)
    .limit(5)
    .get();
    
  console.log(`Found ${busySnap.size} busy slots for SITE_ID: ${SITE_ID}`);
  busySnap.forEach(doc => {
    console.log('---');
    console.log('Doc ID:', doc.id);
    console.log('Data:', JSON.stringify(doc.data(), null, 2));
  });

  if (busySnap.size === 0) {
    console.log('Checking for any busy slots without siteId filter...');
    const allSnap = await db.collection('trainer_busy_slots').limit(5).get();
    console.log(`Found ${allSnap.size} total busy slots.`);
    allSnap.forEach(doc => {
      console.log('---');
      console.log('Doc ID:', doc.id, 'SiteId:', doc.data().siteId);
    });
  }
}

checkData().catch(console.error);
