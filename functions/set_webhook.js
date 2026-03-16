const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'gym-booking-app-bc602' });
const db = admin.firestore();
db.doc('settings/easysocial_webhooks').set({
  client_single_confirm: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzM5NiwiYSI6ImNtbWs4aTVpMzAzdXZ3aXhwaGRsYzhkcHYifQ==",
  manager_single_alert: "https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzQ2MSwiYSI6ImNtbW9lMjlmMDV6NW9yaXhwM3dlcThvYWEifQ=="
}, { merge: true })
  .then(() => { console.log('Successfully set webhook in Firestore'); process.exit(0); })
  .catch(e => { console.error('Error setting webhook:', e); process.exit(1); });
