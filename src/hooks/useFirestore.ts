import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { SITE_ID } from '../constants';

function useDeepCompareMemoize<T>(value: T): T {
    const ref = React.useRef<T>(value);
    
    // Simple deep equality check for arrays of where() constraints
    const deepEqual = (a: any, b: any) => {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch (e) {
            return a === b;
        }
    };

    if (!deepEqual(value, ref.current)) {
        ref.current = value;
    }
    return ref.current;
}

export function useFirestore<T>(collectionName: string, constraints: QueryConstraint[] = [], skip: boolean = false) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const memoizedConstraints = useDeepCompareMemoize(constraints);

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
    }, [collectionName, memoizedConstraints, skip]);

    return { data, loading, error };
}


