const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'gym-booking-app-bc602' });
const db = admin.firestore();

db.doc('settings/easysocial_webhooks').set({
  client_recurring_cancel: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzYxOSwiYSI6ImNtbXU1NmMzejBob3ZzZXhwNmlvbDM1ZG4ifQ==",
  trainer_recurring_cancel: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzYyMCwiYSI6ImNtbXU1Y21rczBrbzdzZXhwY3NudjE0NGQifQ==",
  manager_recurring_cancel: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzYyMSwiYSI6ImNtbXU1ZWF3MjBsZDJzZXhwNGVzM2dxM2YifQ=="
}, { merge: true })
  .then(() => { console.log('✅ Recurring cancel webhooks registered successfully.'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e); process.exit(1); });
