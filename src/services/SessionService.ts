import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs, 
    Timestamp,
    onSnapshot,
    DocumentSnapshot,
    or,
    and
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
    const filters: any[] = [];
    const otherConstraints: any[] = [];

    // 1. Mandatory Site Isolation
    console.log(`SessionService: [Querying] SITE_ID='${SITE_ID}'`);
    filters.push(where('siteId', '==', SITE_ID));

    // 2. Determine query mode
    const hasDateRange = !!(options.startDate || options.endDate);
    const useEndTimeFilter = !options.includePast && !hasDateRange;

    if (useEndTimeFilter) {
        filters.push(where('endTime', '>', Timestamp.now()));
    }

    // 3. Date Range Filtering
    if (options.startDate) {
        const startISO = options.startDate.toISOString().substring(0, 10);
        filters.push(where('date', '>=', startISO));
    }
    if (options.endDate) {
        const endISO = options.endDate.toISOString().substring(0, 10);
        filters.push(where('date', '<=', endISO));
    }

    // 4. Role-based and Target-based Filtering
    if (role === 'client') {
        const myClientId = options.clientId || userId;
        filters.push(or(
            where('clientIds', 'array-contains', myClientId),
            where('serviceName', '==', 'Limitless Open'),
            where('serviceName', '==', 'Limitless Open (Shared)')
        ));
    } else if (role === 'trainer' || role === 'admin' || role === 'manager') {
        if (options.clientId) {
            filters.push(where('client_ids', 'array-contains', options.clientId));
        } else if (options.trainerId) {
            console.log(`SessionService: [Filtering] trainerId='${options.trainerId}'`);
            filters.push(where('trainerId', '==', options.trainerId));
        }
    }

    // 5. Sorting
    if (useEndTimeFilter) {
        otherConstraints.push(orderBy('endTime', 'asc'));
    } else {
        otherConstraints.push(orderBy('date', 'asc'));
    }

    // 6. Pagination
    if (lastVisible) {
        otherConstraints.push(startAfter(lastVisible));
    }
    otherConstraints.push(limit(pageSize));

    // Combine: All filters MUST be wrapped in a single top-level composite filter if OR is used.
    // However, if we just use one top-level and(), it covers all cases safely.
    return query(
        collection(db, 'sessions'),
        and(...filters),
        ...otherConstraints
    );
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
