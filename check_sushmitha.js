import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from 'fs';

// Read config from .env or constants
const firebaseConfig = {
  apiKey: "dummy",
  projectId: "gym-booking-app-bc602",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const querySnapshot = await getDocs(collection(db, "sessions"));
  let found = 0;
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes("sushmitha") || str.includes("gvpzbQI5vLNWxSUtjZECWgNjM5b2")) {
      console.log(`Found session: ${doc.id}`);
      console.log(`Date: ${data.date}`);
      console.log(`ServiceName: ${data.serviceName}`);
      console.log(`Status: ${data.status}`);
      found++;
    }
  });
  console.log(`Total sessions found for Sushmitha: ${found}`);
}
main().catch(console.error);
