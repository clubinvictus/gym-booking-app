import { db } from './src/firebase';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { SITE_ID } from './src/constants';

async function checkBusySlots() {
  const q = query(
    collection(db, 'trainer_busy_slots'),
    where('siteId', '==', SITE_ID),
    limit(5)
  );
  
  const snapshot = await getDocs(q);
  console.log(`Found ${snapshot.size} busy slots for SITE_ID: ${SITE_ID}`);
  
  snapshot.forEach(doc => {
    console.log('Doc ID:', doc.id);
    console.log('Data:', JSON.stringify(doc.data(), null, 2));
  });
}

checkBusySlots().catch(console.error);
