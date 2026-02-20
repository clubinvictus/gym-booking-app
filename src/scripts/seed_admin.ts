import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Run this ONCE to create the admin document in the 'admins' collection.
 * This replaces the hardcoded email check in LoginPage.tsx.
 * 
 * Usage: Import and call from browser console or a temp button,
 * then remove this script.
 */
export const seedAdminUser = async () => {
    await setDoc(doc(db, 'admins', 'admin_marc'), {
        email: 'marc@clubinvictus.com',
        name: 'Marc',
        siteId: 'invictus-booking',
        createdAt: new Date().toISOString()
    });
    console.log('Admin document created for marc@clubinvictus.com');
};
