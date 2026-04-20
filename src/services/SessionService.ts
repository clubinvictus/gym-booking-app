import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs, 
    Timestamp,
    QueryConstraint,
    onSnapshot,
    DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { SITE_ID } from '../constants';

export type UserRole = 'client' | 'trainer' | 'admin' | 'manager';

export interface FetchSessionsOptions {
    role: UserRole;
    userId: string;
    startDate?: Date;
    endDate?: Date;
    pageSize?: number;
    lastVisible?: DocumentSnapshot | null;
    includePast?: boolean; // If true, omits the endTime > now filter
    clientId?: string;    // Used by Admins to filter for a specific client
    trainerId?: string;   // Used by Admins to filter for a specific trainer
}

export interface Session {
    id: string;
    serviceId: string;
    serviceName: string;
    trainerId: string;
    trainerName: string;
    uids: string[];
    client_ids: string[];
    startTime: Timestamp | Date;
    endTime: Timestamp | Date;
    status: string;
    siteId: string;
    [key: string]: any;
}

/**
 * Shared logic to build the Firestore query for sessions
 * 1. Site isolation (siteId)
 * 2. Time filtering (endTime > now)
 * 3. Role-based filtering (uids for clients, trainerId for trainers)
 * 4. Sorting (date ASC)
 */
export const buildSessionsQuery = (options: FetchSessionsOptions) => {
    const { role, userId, pageSize = 10, lastVisible } = options;
    const constraints: QueryConstraint[] = [];

    // 1. Mandatory Site Isolation
    console.log(`SessionService: [Querying] SITE_ID='${SITE_ID}'`);
    constraints.push(where('siteId', '==', SITE_ID));

    // 2. Time Filtering
    // By default, we only show upcoming sessions (endTime > now).
    // Views like Calendar or History can opt-out by setting includePast: true.
    if (!options.includePast) {
        constraints.push(where('endTime', '>', Timestamp.now()));
    }

    // 3. Date Range Filtering
    // Standardizing on 'date' (ISO string) for the primary range filter
    if (options.startDate) {
        const startISO = options.startDate.toISOString().substring(0, 10);
        constraints.push(where('date', '>=', startISO));
    }
    if (options.endDate) {
        const endISO = options.endDate.toISOString().substring(0, 10);
        constraints.push(where('date', '<=', endISO));
    }

    // 4. Role-based and Target-based Filtering
    if (role === 'client') {
        constraints.push(where('uids', 'array-contains', userId));
    } else if (role === 'trainer' || role === 'admin' || role === 'manager') {
        // Staff see all by default, but can filter for specific profiles
        if (options.clientId) {
            constraints.push(where('client_ids', 'array-contains', options.clientId));
        } else if (options.trainerId) {
            console.log(`SessionService: [Filtering] trainerId='${options.trainerId}'`);
            constraints.push(where('trainerId', '==', options.trainerId));
        }
    }

    // 5. Sorting (Must match the range filter field if one is used)
    constraints.push(orderBy('date', 'asc'));

    // 6. Pagination
    if (lastVisible) {
        constraints.push(startAfter(lastVisible));
    }
    constraints.push(limit(pageSize));

    return query(collection(db, 'sessions'), ...constraints);
};

/**
 * One-time fetch of sessions with pagination support
 */
export const fetchSessions = async (options: FetchSessionsOptions) => {
    const q = buildSessionsQuery(options);
    const snapshot = await getDocs(q);
    
    const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Session[];

    const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    return {
        sessions,
        lastVisible: lastVisibleDoc
    };
};

/**
 * Subscription helper for centralized logic
 */
export const subscribeSessions = (
    options: FetchSessionsOptions, 
    onUpdate: (data: { sessions: Session[], lastVisible: DocumentSnapshot | null }) => void,
    onError?: (err: any) => void
) => {
    const q = buildSessionsQuery(options);
    
    return onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Session[];
        
        const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        
        onUpdate({
            sessions,
            lastVisible: lastVisibleDoc
        });
    }, (err) => {
        console.error('SessionService Subscription Error:', err);
        if (onError) onError(err);
    });
};
