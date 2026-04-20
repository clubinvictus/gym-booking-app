import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { SITE_ID } from '../constants';

export interface TrialBookingData {
    name: string;
    email: string;
    phone: string;
    password: string;
    slot: {
        date: string;
        time: string;
        trainerId: string;
        trainerName: string;
        day: number;
    };
    service: {
        id: string;
        name: string;
    };
}

/**
 * Invokes the secure backend flow for creating a lead-gen trial booking.
 */
export const submitTrialBooking = async (data: TrialBookingData) => {
    try {
        const processTrialBooking = httpsCallable(functions, 'processTrialBooking');
        
        // Include SITE_ID in the payload
        const response = await processTrialBooking({
            ...data,
            siteId: SITE_ID
        });

        const result = response.data as { success: boolean; uid: string; clientId: string };
        return result;

    } catch (error: any) {
        console.error('Trial booking backend failure:', error);

        // Map backend errors to user-friendly messages
        if (error.code === 'already-exists') {
            throw new Error('Looks like you already have an account! Please log in to book your session.');
        }

        if (error.message) {
            throw new Error(error.message);
        }

        throw new Error('An unexpected error occurred during the trial booking. Please try again.');
    }
};
