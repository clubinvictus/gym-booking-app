
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, db } from '../firebase';
import { 
    signInWithPopup,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile, 
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { LogIn, UserPlus } from 'lucide-react';
import { SITE_ID } from '../constants';

export const LoginPage = () => {
    const [isSignIn, setIsSignIn] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resetSent, setResetSent] = useState(false);
    const navigate = useNavigate();

    const determineRoleAndRedirect = async (user: any) => {
        try {
            const normalizedEmail = user.email?.toLowerCase();
            console.log('Detecting role for:', normalizedEmail, 'UID:', user.uid);

            if (!normalizedEmail) {
                console.error('No email found for user during role detection');
                navigate('/dashboard');
                return;
            }

            // 1. Check if Admin (via Firestore 'admins' collection)
            const adminsRef = collection(db, 'admins');
            const adminQ = query(adminsRef, where('email', '==', normalizedEmail));
            const adminQuerySnapshot = await getDocs(adminQ);

            if (!adminQuerySnapshot.empty) {
                console.log('Role identified: Admin');
                await setDoc(doc(db, 'users', user.uid), {
                    email: normalizedEmail,
                    role: 'admin',
                    name: user.displayName || fullName || 'Admin',
                    phone: adminQuerySnapshot.docs[0].data().phone || '',
                    siteId: adminQuerySnapshot.docs[0].data().siteId || SITE_ID
                }, { merge: true });
                navigate('/dashboard');
                return;
            }

            // 2. Check if Manager
            const managersRef = collection(db, 'managers');
            const managerQ = query(managersRef, where('email', '==', normalizedEmail));
            const managerQuerySnapshot = await getDocs(managerQ);

            if (!managerQuerySnapshot.empty) {
                console.log('Role identified: Manager');
                await setDoc(doc(db, 'users', user.uid), {
                    email: normalizedEmail,
                    role: 'manager',
                    managerId: managerQuerySnapshot.docs[0].id,
                    name: user.displayName || fullName || managerQuerySnapshot.docs[0].data().name,
                    phone: managerQuerySnapshot.docs[0].data().phone || '',
                    siteId: managerQuerySnapshot.docs[0].data().siteId || SITE_ID
                }, { merge: true });
                navigate('/dashboard');
                return;
            }

            // 3. Check if Trainer
            const trainersRef = collection(db, 'trainers');
            const q = query(trainersRef, where('email', '==', normalizedEmail));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                console.log('Role identified: Trainer');
                await setDoc(doc(db, 'users', user.uid), {
                    email: normalizedEmail,
                    role: 'trainer',
                    trainerId: querySnapshot.docs[0].id,
                    name: user.displayName || fullName || querySnapshot.docs[0].data().name,
                    phone: querySnapshot.docs[0].data().phone || '',
                    siteId: querySnapshot.docs[0].data().siteId || SITE_ID
                }, { merge: true });
                navigate('/dashboard');
                return;
            }

            console.log('Role identified: Client (Default)');
            // 4. Default to Client
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
                const clientName = user.displayName || fullName || 'New Client';
                let clientId = '';

                // Check if admin already created a client record for this email
                const clientsRef = collection(db, 'clients');
                const clientQ = query(clientsRef, where('email', '==', normalizedEmail));
                const clientQuerySnapshot = await getDocs(clientQ);

                if (!clientQuerySnapshot.empty) {
                    console.log('Linking to existing client record');
                    clientId = clientQuerySnapshot.docs[0].id;
                } else {
                    console.log('Creating new client record');
                    const { addDoc } = await import('firebase/firestore');
                    const newClientRef = await addDoc(collection(db, 'clients'), {
                        name: clientName,
                        email: normalizedEmail,
                        phone: '', 
                        membership_tier: 'limitless',
                        joined: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        status: 'Active',
                        siteId: SITE_ID,
                        createdAt: new Date().toISOString()
                    });
                    clientId = newClientRef.id;
                }

                // Create the user profile with the linked clientId
                await setDoc(doc(db, 'users', user.uid), {
                    email: normalizedEmail,
                    role: 'client',
                    name: clientName,
                    clientId: clientId,
                    phone: clientQuerySnapshot.empty ? '' : (clientQuerySnapshot.docs[0].data().phone || ''),
                    membership_tier: 'limitless',
                    siteId: SITE_ID
                });
            }
            navigate('/dashboard');
        } catch (err) {
            console.error('Role detection error:', err);
            setError('Failed to determine user role.');
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            if (result?.user) {
                await determineRoleAndRedirect(result.user);
            }
        } catch (err: any) {
            console.error('Google login error:', err);
            if (err.code === 'auth/popup-blocked') {
                setError('Popup was blocked by your browser. Please allow popups for this site, or use the Email & Password option below.');
            } else if (err.code === 'auth/popup-closed-by-user') {
                setError('Sign-in was cancelled.');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignIn) {
                const result = await signInWithEmailAndPassword(auth, email, password);
                await determineRoleAndRedirect(result.user);
            } else {
                const result = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(result.user, { displayName: fullName });
                await determineRoleAndRedirect(result.user);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError("Please enter your email address first.");
            return;
        }

        setLoading(true);
        setError(null);
        setResetSent(false);

        try {
            await sendPasswordResetEmail(auth, email);
            setResetSent(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
            padding: '20px'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <img src="/logo black.png" alt="Invictus" style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '16px' }} />
                    <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Invictus Calendar</h1>
                    <p className="text-muted">Sign in to manage your bookings</p>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: '#fff',
                        border: '2px solid #000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        marginBottom: '24px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </button>

                <div style={{ position: 'relative', marginBottom: '32px', textAlign: 'center' }}>
                    <hr style={{ border: '0', borderTop: '1px solid #eee' }} />
                    <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '0 12px', color: '#999', fontSize: '0.8rem' }}>OR</span>
                </div>

                <div style={{
                    display: 'flex',
                    background: '#f0f0f0',
                    padding: '4px',
                    borderRadius: 0,
                    marginBottom: '32px'
                }}>
                    <button
                        onClick={() => setIsSignIn(true)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            border: 'none',
                            borderRadius: 0,
                            background: isSignIn ? '#000' : 'transparent',
                            color: isSignIn ? '#fff' : '#000',
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        SIGN IN
                    </button>
                    <button
                        onClick={() => setIsSignIn(false)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            border: 'none',
                            borderRadius: 0,
                            background: !isSignIn ? '#000' : 'transparent',
                            color: !isSignIn ? '#fff' : '#000',
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        SIGN UP
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {error && (
                        <div style={{ padding: '12px', background: '#fff1f1', border: '2px solid #ff4444', color: '#ff4444', fontWeight: 800, fontSize: '0.8rem' }}>
                            {error}
                        </div>
                    )}

                    {resetSent && (
                        <div style={{ padding: '12px', background: '#e6fffa', border: '2px solid #000', color: '#000', fontWeight: 800, fontSize: '0.85rem' }}>
                            Password reset email sent! Check your inbox.
                        </div>
                    )}

                    {!isSignIn && (
                        <div>
                            <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.85rem' }}>FULL NAME</label>
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '2px solid #000',
                                    borderRadius: 0,
                                    fontSize: '1rem',
                                    fontWeight: 600
                                }}
                                placeholder="John Doe"
                            />
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.85rem' }}>EMAIL ADDRESS</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                border: '2px solid #000',
                                borderRadius: 0,
                                fontSize: '1rem',
                                fontWeight: 600
                            }}
                            placeholder="your@email.com"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.85rem' }}>PASSWORD</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                border: '2px solid #000',
                                borderRadius: 0,
                                fontSize: '1rem',
                                fontWeight: 600
                            }}
                            placeholder="••••••••"
                        />
                        {isSignIn && (
                            <button
                                type="button"
                                onClick={handleForgotPassword}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#666',
                                    fontSize: '0.8rem',
                                    marginTop: '8px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    textDecoration: 'underline'
                                }}
                            >
                                Forgot your password? Reset it here.
                            </button>
                        )}
                    </div>
                    <button type="submit" disabled={loading} className="button-primary" style={{ marginTop: '12px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {loading ? 'PROCESSING...' : (isSignIn ? <><LogIn size={20} /> SIGN IN</> : <><UserPlus size={20} /> CREATE ACCOUNT</>)}
                    </button>
                </form>
            </div>
        </div>
    );
};
