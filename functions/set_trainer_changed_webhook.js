// Registers the webhook URL for the "client_trainer_changed" WhatsApp template, sent when a
// session is reassigned to a different trainer (see functions/index.js onSessionWritten,
// trainerChanged branch) but the date/time stays the same.
//
// Before running this:
//   1. Create a new template in the EasySocial campaigns dashboard named client_trainer_changed
//      (or whatever name you like — the string below just needs to match the template key used
//      in onSessionWritten). Suggested variables to include: clientName, trainerName, date, time.
//   2. Copy its webhook URL and paste it in place of the placeholder below.
//   3. Run: node functions/set_trainer_changed_webhook.js
//
// Until this is run, reassignment still works — sendWhatsAppTemplate() no-ops with a console.warn
// when a template's webhook URL isn't configured (functions/index.js), it doesn't throw.
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'gym-booking-app-bc602' });
const db = admin.firestore();

const WEBHOOK_URL = 'REPLACE_ME_WITH_THE_EASYSOCIAL_WEBHOOK_URL';

if (WEBHOOK_URL.startsWith('REPLACE_ME')) {
  console.error('❌ Edit this file first: paste the real webhook URL in place of the placeholder.');
  process.exit(1);
}

db.doc('settings/easysocial_webhooks').set({
  client_trainer_changed: WEBHOOK_URL
}, { merge: true })
  .then(() => { console.log('✅ client_trainer_changed webhook registered successfully.'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e); process.exit(1); });
