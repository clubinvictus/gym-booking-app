import { 
    collection, 
    getDocs, 
    query, 
    where
} from 'firebase/firestore';
import { db } from './src/firebase';

async function auditDates() {
    console.log('--- Auditing Session Dates ---');
    const sessionsSnap = await getDocs(collection(db, 'sessions'));
    const dateCounts: Record<string, number> = {};
    const siteCounts: Record<string, number> = {};
    const trainerCounts: Record<string, number> = {};

    sessionsSnap.forEach(doc => {
        const data = doc.data();
        // Extract Year-Month
        const dateStr = data.date || '';
        const month = dateStr.substring(0, 7); // "YYYY-MM"
        dateCounts[month] = (dateCounts[month] || 0) + 1;

        const site = data.siteId || 'MISSING';
        siteCounts[site] = (siteCounts[site] || 0) + 1;

        const trainer = data.trainerId || 'MISSING';
        trainerCounts[trainer] = (trainerCounts[trainer] || 0) + 1;
    });

    console.log('Sessions per Month:', dateCounts);
    console.log('Sessions per Site:', siteCounts);
    console.log('Sessions per Trainer:', trainerCounts);
}

auditDates();
