import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { SITE_ID } from '../constants';

async function main() {
    console.log("Checking sessions for Sushmitha...");
    const sessionsRef = collection(db, 'sessions');
    // Let's get any session where 'uids' contains Sushmitha's uid
    const q1 = query(sessionsRef, where('uids', 'array-contains', 'gvpzbQI5vLNWxSUtjZECWgNjM5b2'));
    const snap1 = await getDocs(q1);
    console.log(`Found ${snap1.size} sessions with uids array-contains`);
    
    // check client_ids
    const q2 = query(sessionsRef, where('client_ids', 'array-contains', 'gvpzbQI5vLNWxSUtjZECWgNjM5b2'));
    const snap2 = await getDocs(q2);
    console.log(`Found ${snap2.size} sessions with client_ids array-contains`);

    if (snap1.size > 0) {
        console.log("Sample session with uids:", snap1.docs[0].data());
    }
}

main().catch(console.error);
