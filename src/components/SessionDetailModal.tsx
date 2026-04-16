import { useState, useEffect } from 'react';
import { X, Clock, User, Briefcase, Calendar as CalendarIcon, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import { doc, deleteDoc, collection, getDocs, query, where, writeBatch, QueryDocumentSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useConfirm } from '../ConfirmContext';
import { SITE_ID } from '../constants';

interface SessionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: any;
    onDelete: (sessionId: string) => void;
    onReschedule: (session: any) => void;
}

export const SessionDetailModal = ({ isOpen, onClose, session, onDelete, onReschedule }: SessionDetailModalProps) => {
    const confirm = useConfirm();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [deleteScope, setDeleteScope] = useState<'single' | 'future'>('single');
    const { profile } = useAuth();
    const isTrainer = profile?.role === 'trainer';
    const [targetClientId, setTargetClientId] = useState<string | undefined>(undefined);

    // Reset state when modal opens/closes or session changes
    useEffect(() => {
        if (isOpen) {
            setIsDeleting(false);
            setIsProcessing(false);
            setDeleteScope('single');
        }
    }, [isOpen, session]);

    if (!isOpen || !session) return null;

    const confirmDelete = async (clientId?: string) => {
        setIsProcessing(true);

        const logActivity = async (isRecurring: boolean, removedClientId?: string) => {
            try {
                const removedClient = session.clients?.find((c: any) => c.id === removedClientId);
                await addDoc(collection(db, 'activity_logs'), {
                    action: 'cancelled',
                    isRecurring,
                    sessionDetails: {
                        clientName: removedClientId ? (removedClient?.name || 'Unknown') : (session.clients?.[0]?.name || session.clientName),
                        trainerName: session.trainerName,
                        serviceName: session.serviceName,
                        date: session.date,
                        time: session.time,
                        recurringDetails: session.recurringDetails || null
                    },
                    performedBy: {
                        uid: profile?.uid || 'unknown',
                        name: profile?.name || 'Unknown User',
                        role: profile?.role || 'unknown'
                    },
                    timestamp: new Date().toISOString(),
                    siteId: SITE_ID
                });
            } catch (err) {
                console.error('Failed to log activity:', err);
            }
        };

        if (deleteScope === 'future' && session.seriesId) {
            try {
                const batch = writeBatch(db);
                // For recurring, we'll keep the logic simple for now: delete the documents
                // In a multi-client world, this might need refinement (e.g. only remove THIS client from the documents)
                const baseQueries: any[] = [where('seriesId', '==', session.seriesId)];
                
                const q = query(collection(db, 'sessions'), ...baseQueries);
                
                const snapshot = await getDocs(q);
                snapshot.forEach((docSnap: QueryDocumentSnapshot<any>) => {
                    const docData = docSnap.data();
                    if (docData.date >= session.date) {
                        // If multi-client, just remove THIS client from all future docs
                        if (clientId) {
                            const updatedClients = (docData.clients || []).filter((c: any) => c.id !== clientId);
                            if (updatedClients.length === 0) {
                                batch.delete(docSnap.ref);
                            } else {
                                const newClientIds = Array.from(new Set(updatedClients.map((c: any) => c.id))).filter(Boolean);
                                batch.update(docSnap.ref, { 
                                    clients: updatedClients,
                                    clientIds: newClientIds,
                                    clientId: newClientIds[0] || null
                                });
                            }
                        } else {
                            batch.delete(docSnap.ref);
                        }
                    }
                });
                await batch.commit();

                await logActivity(true, clientId);
                onDelete(session.id);
                onClose();
            } catch (err: any) {
                console.error('Error deleting series:', err);
                alert('Failed to delete series. Please try again.');
                setIsProcessing(false);
            }
        } else {
            // Single delete/removal
            try {
                if (clientId && session.clients && session.clients.length > 1) {
                    const updatedClients = session.clients.filter((c: any) => c.id !== clientId);
                    const newClientIds = Array.from(new Set(updatedClients.map((c: any) => c.id))).filter(Boolean);
                    await updateDoc(doc(db, 'sessions', session.id), { 
                        clients: updatedClients,
                        clientIds: newClientIds,
                        clientId: newClientIds[0] || null
                    });
                } else {
                    await deleteDoc(doc(db, 'sessions', session.id));
                }
                await logActivity(false, clientId);
                onDelete(session.id);
                onClose();
            } catch (err: any) {
                console.error('Error deleting session:', err);
                alert('Failed to delete session. Please try again.');
                setIsProcessing(false);
            }
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '450px',
                padding: '32px',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000'
            }}>
                <button
                    onClick={onClose}
                    disabled={isProcessing}
                    style={{
                        position: 'absolute',
                        right: '20px',
                        top: '20px',
                        background: 'transparent',
                        border: 'none',
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        opacity: isProcessing ? 0.5 : 1
                    }}
                >
                    <X size={24} />
                </button>

                {isDeleting ? (
                    <div>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px', color: '#ff4444' }}>Delete Options</h2>
                        <p className="text-muted" style={{ marginBottom: '24px' }}>
                            {session.seriesId ? 'Please select how you want to delete this recurring appointment.' : 'Are you sure you want to delete this session?'}
                        </p>

                        {session.seriesId && (
                            <div style={{ padding: '16px', background: '#f5f5f5', border: '2px solid #000', marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontWeight: 800, marginBottom: '12px', fontSize: '0.8rem', color: '#666' }}>DELETION SCOPE</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                                        <input
                                            type="radio"
                                            name="deleteScope"
                                            value="single"
                                            checked={deleteScope === 'single'}
                                            onChange={() => setDeleteScope('single')}
                                            style={{ width: '20px', height: '20px', accentColor: '#000' }}
                                        />
                                        Just this event
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                                        <input
                                            type="radio"
                                            name="deleteScope"
                                            value="future"
                                            checked={deleteScope === 'future'}
                                            onChange={() => setDeleteScope('future')}
                                            style={{ width: '20px', height: '20px', accentColor: '#000' }}
                                        />
                                        This and future events
                                    </label>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => setIsDeleting(false)}
                                className="button-secondary"
                                style={{ flex: 1, height: '54px' }}
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={async () => {
                                    const confirmed = await confirm({
                                        title: 'Delete Session?',
                                        message: deleteScope === 'future' 
                                            ? 'Are you sure you want to delete this and all future sessions in the series? This action cannot be undone.'
                                            : 'Are you sure you want to delete this session? This action cannot be undone.',
                                        confirmLabel: 'Yes, Delete',
                                        type: 'danger'
                                    });

                                    if (confirmed) {
                                        await confirmDelete(targetClientId);
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    height: '54px',
                                    background: '#000',
                                    color: '#fff',
                                    border: 'none',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}
                            >
                                DELETE
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Session Details</h2>
                        <p className="text-muted" style={{ marginBottom: '32px' }}>Review or modify this booking</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', marginBottom: '8px' }}>Clients</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {Array.isArray(session.clients) ? session.clients.map((c: any) => (
                                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f9f9', padding: '10px 14px', border: '1px solid #eee' }}>
                                                <span style={{ fontSize: '1rem', fontWeight: 800 }}>{c.name}</span>
                                                {!isTrainer && (
                                                    <button 
                                                        onClick={() => {
                                                            setTargetClientId(c.id);
                                                            setIsDeleting(true);
                                                        }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4444', padding: '4px' }}
                                                        title="Remove client"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        )) : (
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.clientName || 'Unknown Client'}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Briefcase size={20} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Trainer</label>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.trainerName}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CalendarIcon size={20} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Service</label>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.serviceName}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Time & Day</label>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.time} (Day {session.day + 1})</div>
                                </div>
                            </div>

                            {session.recurringDetails && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <RefreshCw size={20} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Recurrence</label>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.recurringDetails}</div>
                                    </div>
                                </div>
                            )}

                            {session.createdBy && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CalendarIcon size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#555' }}>Created by: {session.createdBy}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isTrainer && (
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={() => onReschedule(session)}
                                    className="button-secondary"
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '54px' }}
                                >
                                    <Edit2 size={18} />
                                    RESCHEDULE
                                </button>
                                <button
                                    onClick={() => setIsDeleting(true)}
                                    style={{
                                        flex: 1,
                                        height: '54px',
                                        background: '#ff4444',
                                        color: '#fff',
                                        border: 'none',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <Trash2 size={18} />
                                    DELETE
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
