
import { db } from '../firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const cleanupDuplicates = async () => {
    console.log('Starting cleanup...');
    const sessionsRef = collection(db, 'sessions');
    const snapshot = await getDocs(sessionsRef);

    // Group by key
    const groups: { [key: string]: any[] } = {};

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Key by day + time + trainer (and client to be safe?)
        // Let's stick to day/time/trainer as that defines a unique slot availability usually.
        // If multiple clients book the same slot, that's a double booking we also want to fix (unless it's a group class).
        // For Personal Training, it's 1-on-1.

        const key = `${data.day}-${data.time}-${data.trainerName}`;

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push({ id: docSnap.id, ...data });
    });

    let deleteCount = 0;
    let batch = writeBatch(db);
    let opCount = 0;

    for (const key in groups) {
        const sessions = groups[key];
        if (sessions.length > 1) {
            // Sort by createdAt desc (if available), else maybe random?
            // If createdAt is missing, we just keep the first one found.
            sessions.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA; // Descending
            });

            // Keep the first one (index 0), delete the rest
            for (let i = 1; i < sessions.length; i++) {
                batch.delete(doc(db, 'sessions', sessions[i].id));
                deleteCount++;
                opCount++;

                if (opCount >= 450) {
                    await batch.commit();
                    batch = writeBatch(db);
                    opCount = 0;
                    console.log('Committed batch...');
                }
            }
        }
    }

    if (opCount > 0) {
        await batch.commit();
    }

    console.log(`Cleanup complete. Deleted ${deleteCount} duplicate sessions.`);
};

cleanupDuplicates().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
