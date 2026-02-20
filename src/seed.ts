import { db } from './firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { SITE_ID } from './constants';

export const seedInitialData = async () => {
    const batch = writeBatch(db);

    // Seed Trainers
    const defaultAvailability = {
        monday: { active: true, start: '09:00', end: '17:00' },
        tuesday: { active: true, start: '09:00', end: '17:00' },
        wednesday: { active: true, start: '09:00', end: '17:00' },
        thursday: { active: true, start: '09:00', end: '17:00' },
        friday: { active: true, start: '09:00', end: '17:00' },
        saturday: { active: false, start: '10:00', end: '14:00' },
        sunday: { active: false, start: '10:00', end: '14:00' },
    };

    const trainers = [
        { name: 'Alex Rivera', specialties: ['Strength', 'HIIT'], status: 'Active', sessions: 24, availability: defaultAvailability, siteId: SITE_ID },
        { name: 'Sarah Chen', specialties: ['Yoga', 'Mobility'], status: 'Active', sessions: 18, availability: defaultAvailability, siteId: SITE_ID },
        { name: 'Marcus Thorne', specialties: ['Boxing', 'Conditioning'], status: 'Inactive', sessions: 0, availability: defaultAvailability, siteId: SITE_ID },
        { name: 'Elena Vance', specialties: ['Nutrition', 'Fat Loss'], status: 'Active', sessions: 32, availability: defaultAvailability, siteId: SITE_ID },
    ];

    trainers.forEach((t, i) => {
        const trainerRef = doc(db, 'trainers', `trainer_${i + 1}`);
        batch.set(trainerRef, t);
    });

    // Seed Services
    const services = [
        { name: 'Personal Training', duration: 60, price: 80, siteId: SITE_ID },
        { name: 'Semi-Private Session', duration: 60, price: 45, siteId: SITE_ID },
        { name: 'Standard HIIT Class', duration: 45, price: 25, siteId: SITE_ID },
    ];

    services.forEach((s, i) => {
        const serviceRef = doc(db, 'services', `service_${i + 1}`);
        batch.set(serviceRef, s);
    });

    // Seed Clients
    const clients = [
        { name: 'Emma Watson', email: 'emma@example.com', phone: '+1 234 567 890', joined: 'Jan 12, 2026', siteId: SITE_ID },
        { name: 'Mike Johnson', email: 'mike@example.com', phone: '+1 234 567 891', joined: 'Feb 05, 2026', siteId: SITE_ID },
    ];

    clients.forEach((c, i) => {
        const clientRef = doc(db, 'clients', `client_${i + 1}`);
        batch.set(clientRef, c);
    });

    await batch.commit();
    console.log('Seeding complete!');
};
