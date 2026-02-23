import { X, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { doc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { SITE_ID } from '../constants';

interface OffDayModalProps {
    isOpen: boolean;
    onClose: () => void;
    trainer: any;
    date: Date;
    sessions: any[];
    onReschedule: (session: any) => void;
    onRefresh: () => void;
}

export const OffDayModal = ({ isOpen, onClose, trainer, date, sessions, onReschedule, onRefresh }: OffDayModalProps) => {
    const { profile } = useAuth();

    if (!isOpen || !trainer) return null;

    const handleCancelSession = async (session: any) => {
        if (!window.confirm(`Are you sure you want to cancel the session for ${session.clientName} at ${session.time}?`)) return;

        try {
            await deleteDoc(doc(db, 'sessions', session.id));

            // Log activity
            await addDoc(collection(db, 'activity_logs'), {
                action: 'cancelled',
                sessionDetails: {
                    clientName: session.clientName,
                    trainerName: session.trainerName,
                    serviceName: session.serviceName,
                    date: session.date,
                    time: session.time
                },
                performedBy: {
                    uid: profile?.uid || 'unknown',
                    name: profile?.name || 'Unknown User',
                    role: profile?.role || 'unknown'
                },
                timestamp: new Date().toISOString(),
                siteId: SITE_ID
            });

            alert('Session cancelled successfully.');
            onRefresh();
        } catch (error) {
            console.error('Error cancelling session:', error);
            alert('Failed to cancel session.');
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
            padding: '20px',
            backdropFilter: 'blur(4px)'
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '600px',
                maxHeight: '80vh',
                overflowY: 'auto',
                padding: '40px',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        right: '24px',
                        top: '24px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    <X size={24} />
                </button>

                <header style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <AlertCircle size={24} color="#f44336" />
                        <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Off Day: {trainer.name}</h2>
                    </div>
                    <p className="text-muted" style={{ fontSize: '1.1rem' }}>
                        Managing sessions for {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {sessions.length > 0 ? (
                        sessions.map((session) => (
                            <div
                                key={session.id}
                                style={{
                                    padding: '20px',
                                    border: '2px solid #000',
                                    display: 'flex',
                                    flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                                    justifyContent: 'space-between',
                                    alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                                    gap: '16px'
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '4px' }}>
                                        {session.time} - {session.clientName}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: 600 }}>
                                        {session.serviceName}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', width: window.innerWidth <= 768 ? '100%' : 'auto' }}>
                                    <button
                                        onClick={() => onReschedule(session)}
                                        className="button-secondary"
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '8px 16px',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        <Edit2 size={16} />
                                        Reschedule
                                    </button>
                                    <button
                                        onClick={() => handleCancelSession(session)}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '8px 16px',
                                            background: '#fff5f5',
                                            color: '#f44336',
                                            border: '2px solid #f44336',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={16} />
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #ccc' }}>
                            <p style={{ fontWeight: 700, margin: 0 }}>No sessions booked for this day.</p>
                        </div>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="button-primary"
                    style={{ width: '100%', padding: '16px', marginTop: '32px' }}
                >
                    DONE
                </button>
            </div>
        </div>
    );
};
