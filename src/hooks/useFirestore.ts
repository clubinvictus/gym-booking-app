import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { SITE_ID } from '../constants';

export function useFirestore<T>(collectionName: string, constraints: QueryConstraint[] = [], skip: boolean = false) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (skip) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, collectionName),
            where('siteId', '==', SITE_ID),
            ...constraints
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: any[] = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setData(items);
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error('useFirestore error for', collectionName, err);
            setError(err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName, constraints, skip]);

    return { data, loading, error };
}

