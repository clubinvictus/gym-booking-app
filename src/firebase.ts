import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyAt8Y1ABAF9CKpQaXT7eyGxIgfA3Wflsp0",
    authDomain: "gym-booking-app-bc602.firebaseapp.com",
    projectId: "gym-booking-app-bc602",
    storageBucket: "gym-booking-app-bc602.firebasestorage.app",
    messagingSenderId: "243731708773",
    appId: "1:243731708773:web:a2a45ab689cb289c4fff8c",
    measurementId: "G-YNECGDFSV5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
