import { 
    collection, 
    getDocs, 
    query, 
    where, 
    writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase';
import { SITE_ID } from '../constants';

export const healSessions = async () => {
    console.log('--- Starting Session Healing Process ---');
    
    let trainerMap: Record<string, { id: string, uid?: string, email: string, name?: string }> = {};
    let emailToUid: Record<string, string> = {};

    try {
        const trainersSnap = await getDocs(collection(db, 'trainers'));
        trainersSnap.forEach(tDoc => {
            const data = tDoc.data();
            trainerMap[tDoc.id] = { 
                id: tDoc.id, 
                email: data.email?.toLowerCase(),
                name: data.name
            };
        });
        console.log(`SessionHealer: Mapped ${Object.keys(trainerMap).length} trainers`);
    } catch (e) {
        console.warn('SessionHealer: Trainer fetch failed', e);
    }

    try {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'trainer')));
        usersSnap.forEach(uDoc => {
            const data = uDoc.data();
            if (data.email) emailToUid[data.email.toLowerCase()] = uDoc.id;
        });
    } catch (e) {
        console.warn('SessionHealer: User fetch restricted. Relying on fallback.');
    }

    // Resolve trainer Doc IDs to UIDs where possible
    Object.keys(trainerMap).forEach(docId => {
        const email = trainerMap[docId].email;
        if (email && emailToUid[email]) trainerMap[docId].uid = emailToUid[email];
    });

    // 2. Scan sessions
    const sessionsSnap = await getDocs(collection(db, 'sessions'));
    console.log(`SessionHealer: Scanning ${sessionsSnap.size} sessions...`);
    
    let healCount = 0;
    let currentBatch = writeBatch(db);
    let batchSize = 0;
    const BATCH_LIMIT = 450; // Keep slightly under 500 for safety

    const commitBatch = async () => {
        if (batchSize > 0) {
            await currentBatch.commit();
            console.log(`SessionHealer: Committed batch of ${batchSize} updates...`);
            currentBatch = writeBatch(db);
            batchSize = 0;
        }
    };

    for (const sDoc of sessionsSnap.docs) {
        const data = sDoc.data();
        const updates: any = {};
        let needsUpdate = false;

        if (!data.siteId) {
            updates.siteId = SITE_ID;
            needsUpdate = true;
        }

        const currentTrainerId = data.trainerId;
        const trainerName = data.trainerName;
        const isUid = currentTrainerId && currentTrainerId.length >= 20 && !currentTrainerId.startsWith('trainer_');
        
        if (isUid) {
            let matchedTrainerDocId = Object.keys(trainerMap).find(docId => trainerMap[docId].uid === currentTrainerId);
            
            if (!matchedTrainerDocId && trainerName) {
                const sName = trainerName.toLowerCase().trim();
                matchedTrainerDocId = Object.keys(trainerMap).find(docId => {
                    const tName = (trainerMap[docId].name || '').toLowerCase().trim();
                    return tName.includes(sName) || sName.includes(tName);
                });
            }

            if (matchedTrainerDocId && matchedTrainerDocId !== currentTrainerId) {
                updates.trainerId = matchedTrainerDocId;
                updates.trainerUid = currentTrainerId;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            currentBatch.update(sDoc.ref, updates);
            batchSize++;
            healCount++;

            if (batchSize >= BATCH_LIMIT) {
                await commitBatch();
            }
        }
    }

    // Final commit
    await commitBatch();
    console.log(`--- Healing Complete: ${healCount} sessions updated ---`);
};
