import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';

interface AuthContextType {
    user: User | null;
    profile: any | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                // 1. Listen to profile changes
                const profileRef = doc(db, 'users', firebaseUser.uid);
                const profileUnsubscribe = onSnapshot(profileRef, (docSnap) => {
                    setProfile(docSnap.data() || null);
                    setLoading(false);
                }, (err) => {
                    console.error('Profile listener error:', err);
                    setLoading(false);
                });

                // 2. Background Sync: Ensure profile has trainerId if they are a trainer
                // This handles cases where the doc ID and UID are linked via email
                try {
                    const q = query(collection(db, 'trainers'), where('email', '==', firebaseUser.email?.toLowerCase()));
                    const tSnap = await getDocs(q);
                    if (!tSnap.empty) {
                        const tDoc = tSnap.docs[0];
                        await updateDoc(profileRef, {
                            trainerId: tDoc.id,
                            siteId: tDoc.data().siteId || 'invictus-booking'
                        });
                    }
                } catch (e) {
                    console.warn('AuthProvider: Profile sync issue (might be permission related)', e);
                }

                return () => profileUnsubscribe();
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
