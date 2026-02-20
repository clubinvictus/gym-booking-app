import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { SITE_ID } from '../constants';

export function useFirestore<T>(collectionName: string, constraints: QueryConstraint[] = []) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
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
        }, (err) => {
            console.error(err);
            setError(err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName, ...constraints]);

    return { data, loading, error };
}
