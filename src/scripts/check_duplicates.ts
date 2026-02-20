
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { firebaseConfig } from "./firebase"; // Assuming firebase.ts exports firebaseConfig or similar
// If firebase.ts initializes app directly, we might need to adjust.
// Let's use the env vars pattern or just import from firebase.ts if possible.
// Actually, let's just use the existing firebase.ts if it exports db.

import { db } from '../firebase';

const checkDuplicates = async () => {
    const sessionsRef = collection(db, 'sessions');
    const snapshot = await getDocs(sessionsRef);

    const slots: { [key: string]: number } = {};
    const duplicates: string[] = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        // Key by day + time (and maybe trainer?)
        // data.day is index 0-6. data.time is "09:00 AM".
        // Let's just key by day/time for now.
        const key = `${data.day}-${data.time}-${data.trainerName}`; // Using trainerName as part of key

        if (slots[key]) {
            slots[key]++;
            duplicates.push(key);
        } else {
            slots[key] = 1;
        }
    });

    console.log(`Checked ${snapshot.size} sessions.`);
    console.log(`Found ${duplicates.length} duplicates.`);
    if (duplicates.length > 0) {
        console.log("Duplicate keys:", [...new Set(duplicates)]);
    }
};

checkDuplicates().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
