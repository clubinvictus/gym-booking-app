import { useState, useEffect, useCallback, useRef } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { subscribeSessions, fetchSessions } from '../services/SessionService';
import type { Session, FetchSessionsOptions, UserRole } from '../services/SessionService';

interface UseSessionsResult {
    sessions: Session[];
    loading: boolean;
    error: any;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    refresh: () => void;
}

export function useSessions(options: Omit<FetchSessionsOptions, 'lastVisible'>): UseSessionsResult {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(false);
    
    // To avoid stale closures in effects/subscriptions
    const optionsRef = useRef(options);
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    // Track if we should skip the query (e.g. userId not ready or profile hasn't loaded a valid role yet)
    // We strictly wait for a role to avoid "Guest/Admin" query rejections for Clients
    const shouldSkip = !options.userId || !options.role || options.role === 'admin' && !options.userId; 
    // Wait, if it's admin, we need the userId to verify the role in firestore.rules anyway.
    // Actually, just ensuring options.role is provided by the caller who has the profile is enough.

    /**
     * Real-time subscription for the FIRST page
     */
    useEffect(() => {
        if (shouldSkip) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // Reset state for new query
        setSessions([]);
        setLastVisible(null);
        setHasMore(false);

        const unsubscribe = subscribeSessions(
            { ...options, lastVisible: null },
            ({ sessions: newSessions, lastVisible: newLastVisible }) => {
                setSessions(newSessions);
                setLastVisible(newLastVisible);
                // If we got as many as requested, there might be more
                setHasMore(newSessions.length >= (options.pageSize || 10));
                setLoading(false);
            },
            (err) => {
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [
        options.userId, 
        options.role, 
        options.startDate?.getTime(), 
        options.endDate?.getTime(), 
        options.pageSize, 
        options.includePast,
        options.trainerId,
        options.clientId,
        shouldSkip
    ]);

    /**
     * Load more sessions (one-time fetch for subsequent pages)
     */
    const loadMore = useCallback(async () => {
        if (loading || !hasMore || !lastVisible || shouldSkip) return;

        setLoading(true);
        try {
            const { sessions: nextSessions, lastVisible: nextLastVisible } = await fetchSessions({
                ...optionsRef.current,
                lastVisible
            });

            if (nextSessions.length > 0) {
                setSessions(prev => [...prev, ...nextSessions]);
                setLastVisible(nextLastVisible);
                setHasMore(nextSessions.length >= (optionsRef.current.pageSize || 10));
            } else {
                setHasMore(false);
            }
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [loading, hasMore, lastVisible, shouldSkip]);

    /**
     * Manual refresh (helpful if not using real-time for some reason)
     */
    const refresh = useCallback(() => {
        // Just triggering the effect is usually enough, but we can expose this
        setLastVisible(null);
    }, []);

    return {
        sessions,
        loading,
        error,
        hasMore,
        loadMore,
        refresh
    };
}
