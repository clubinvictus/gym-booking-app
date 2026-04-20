import { 
    collection, 
    getDocs, 
    writeBatch,
    query,
    limit
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * UTILITY: Session Purger
 * Safely removes all documents from the sessions collection in batches.
 */
export const purgeAllSessions = async () => {
    console.log('--- Starting Global Session Purge ---');
    
    let totalDeleted = 0;
    const BATCH_SIZE = 450;
    
    while (true) {
        // Fetch a chunk of sessions
        const q = query(collection(db, 'sessions'), limit(BATCH_SIZE));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) break;
        
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        totalDeleted += snapshot.size;
        console.log(`SessionPurger: Deleted ${totalDeleted} sessions so far...`);
        
        // Safety break if it's somehow looping indefinitely
        if (totalDeleted > 10000) {
            console.error('SessionPurger: Safety limit exceeded. Aborting.');
            break;
        }
    }
    
    console.log(`--- Purge Complete: ${totalDeleted} sessions removed ---`);
    return totalDeleted;
};
