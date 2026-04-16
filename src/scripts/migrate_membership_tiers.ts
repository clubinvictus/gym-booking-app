import { db } from '../firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const migrateMembershipTiers = async () => {
    console.log('Starting Membership Tier Migration...');
    let batch = writeBatch(db);
    let opCount = 0;

    // 1. Update Clients
    console.log('Updating clients...');
    const clientsRef = collection(db, 'clients');
    const clientsSnap = await getDocs(clientsRef);
    
    for (const clientDoc of clientsSnap.docs) {
        batch.update(doc(db, 'clients', clientDoc.id), {
            membership_tier: 'limitless' // Default backwards compatibility
        });
        opCount++;
        if (opCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
            console.log('Committed batch for clients...');
        }
    }

    // 2. Update Users table (as users might also hold client profiles)
    console.log('Updating users...');
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    
    for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        if (userData.role === 'client') {
            batch.update(doc(db, 'users', userDoc.id), {
                membership_tier: 'limitless'
            });
            opCount++;
            if (opCount >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                opCount = 0;
                console.log('Committed batch for users...');
            }
        }
    }

    // 3. Update Services
    console.log('Updating services...');
    const servicesRef = collection(db, 'services');
    const servicesSnap = await getDocs(servicesRef);
    
    for (const serviceDoc of servicesSnap.docs) {
        batch.update(doc(db, 'services', serviceDoc.id), {
            allowed_tiers: ['limitless', 'limitless_open'] // Default allow all
        });
        opCount++;
        if (opCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
            console.log('Committed batch for services...');
        }
    }

    if (opCount > 0) {
        await batch.commit();
    }

    console.log('Migration complete successfully.');
};

migrateMembershipTiers().then(() => process.exit(0)).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
