const axios = require('axios');
const qs = require('qs');

const webhookUrl = 'https://api.easysocial.in/api/v1/campaigns/webhook/eyJjIjoxNzM5NiwiYSI6ImNtbWs4aTVpMzAzdXZ3aXhwaGRsYzhkcHYifQ==';

async function testFormUrlEncoded() {
    console.log('--- TESTING APPLICATION/X-WWW-FORM-URLENCODED ---');
    
    // We send it as standard form data instead of a JSON string
    const payload = qs.stringify({
        phone: '919008168303',
        clientName: 'Marc Form Test',
        trainerName: 'Jane Trainer',
        date: 'Wed, Mar 11, 2026',
        time: '10:00'
    });

    try {
        const resp = await axios.post(webhookUrl, payload, {
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded' 
            }
        });
        console.log(`✅ Success (200 OK) -> EasySocial accepted the Form Ping.`);
    } catch (e) {
        console.error(`❌ Failed:`, e.message);
    }
}

testFormUrlEncoded().then(() => process.exit(0)).catch(() => process.exit(1));
