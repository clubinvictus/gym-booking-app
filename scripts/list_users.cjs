const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

if (getApps().length === 0) {
    initializeApp({ projectId: 'gym-booking-app-bc602' });
}
const auth = getAuth();

async function findUser() {
    try {
        let pageToken;
        do {
            const listUsersResult = await auth.listUsers(1000, pageToken);
            listUsersResult.users.forEach((userRecord) => {
                const name = (userRecord.displayName || '').toLowerCase();
                if (name.includes('krithiga') || name.includes('karithi')) {
                    console.log('Found:', userRecord.toJSON());
                }
            });
            pageToken = listUsersResult.pageToken;
        } while (pageToken);
    } catch (err) {
        console.error(err);
    }
}
findUser();
