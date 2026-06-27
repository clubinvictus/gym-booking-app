import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

const app = initializeApp({projectId: 'gym-booking-app-bc602'});
const db = getFirestore(app);

async function main() {
  const q = query(collection(db, 'clients'), where('name', '>=', 'Sushmitha'), where('name', '<=', 'Sushmitha\uf8ff'));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log("Found client:", doc.id, doc.data().name, doc.data().phone);
  });
}
main().catch(console.error);
