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
 * Shared logic to build the Firestore query for sessions.
 *
 * KEY RULES for Firestore composite queries:
 * - When using an inequality filter (>, <, >=, <=) on field X, the first orderBy MUST be on field X.
 * - Equality filters (==) can be combined freely.
 * - The siteId equality filter is always first, enabling the composite index.
 */
export const buildSessionsQuery = (options: FetchSessionsOptions) => {
    const { role, userId, pageSize = 10, lastVisible } = options;
    const constraints: QueryConstraint[] = [];

    // 1. Mandatory Site Isolation
    console.log(`SessionService: [Querying] SITE_ID='${SITE_ID}'`);
    constraints.push(where('siteId', '==', SITE_ID));

    // 2. Determine query mode:
    //    - Calendar/History view: uses date range (startDate/endDate), order by 'date'
    //    - Dashboard/upcoming view: uses endTime > now, must order by 'endTime' first
    const hasDateRange = !!(options.startDate || options.endDate);
    const useEndTimeFilter = !options.includePast && !hasDateRange;

    if (useEndTimeFilter) {
        // Upcoming sessions: filter future sessions only
        constraints.push(where('endTime', '>', Timestamp.now()));
    }

    // 3. Date Range Filtering (Calendar view)
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
        if (options.clientId) {
            constraints.push(where('client_ids', 'array-contains', options.clientId));
        } else if (options.trainerId) {
            console.log(`SessionService: [Filtering] trainerId='${options.trainerId}'`);
            constraints.push(where('trainerId', '==', options.trainerId));
        }
    }

    // 5. Sorting — MUST match the inequality filter field to avoid index errors.
    //    - endTime filter → orderBy endTime
    //    - date range filter (or includePast) → orderBy date
    if (useEndTimeFilter) {
        constraints.push(orderBy('endTime', 'asc'));
    } else {
        constraints.push(orderBy('date', 'asc'));
    }

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
