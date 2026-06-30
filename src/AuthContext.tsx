import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, getDocs, collection, query, where, getDoc, setDoc } from 'firebase/firestore';

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
                    console.warn('AuthProvider: Trainer profile sync issue', e);
                }

                // 3. Background Sync: Link client profile on first login.
                // If a clients/ document exists for this email but clientId isn't set
                // on the users/ doc, wire them up so session queries work correctly.
                try {
                    const userSnap = await getDoc(profileRef);
                    const userProfile = userSnap.data();

                    if (!userProfile?.clientId && firebaseUser.email) {
                        const cq1 = query(
                            collection(db, 'clients'),
                            where('email', '==', firebaseUser.email.toLowerCase())
                        );
                        let cSnap = await getDocs(cq1);

                        // If not found by lowercase, try exact case just in case the admin typed it with capitals
                        if (cSnap.empty) {
                            const cq2 = query(
                                collection(db, 'clients'),
                                where('email', '==', firebaseUser.email)
                            );
                            cSnap = await getDocs(cq2);
                        }

                        if (!cSnap.empty) {
                            const clientDoc = cSnap.docs[0];
                            const updates: any = { clientId: clientDoc.id };

                            // If the user doc doesn't have a role yet, set it to client
                            if (!userProfile?.role) updates.role = 'client';

                            // If users doc doesn't exist yet, create it
                            if (!userSnap.exists()) {
                                await setDoc(profileRef, {
                                    email: firebaseUser.email,
                                    name: clientDoc.data().name || firebaseUser.displayName || '',
                                    role: 'client',
                                    clientId: clientDoc.id,
                                    siteId: clientDoc.data().siteId || 'invictus-booking'
                                });
                            } else {
                                await updateDoc(profileRef, updates);
                            }
                            console.log(`AuthProvider: Linked users/${firebaseUser.uid} → clients/${clientDoc.id}`);
                        }
                    }
                } catch (e) {
                    console.warn('AuthProvider: Client profile link issue', e);
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
