import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const app = initializeApp({projectId: 'gym-booking-app-bc602'});
const db = getFirestore(app);

async function main() {
  // We know her UID is gvpzbQI5vLNWxSUtjZECWgNjM5b2
  const userRef = doc(db, "users", "gvpzbQI5vLNWxSUtjZECWgNjM5b2");
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    console.log("User doc:", userSnap.data());
  } else {
    console.log("User doc not found!");
  }
}
main().catch(console.error);
