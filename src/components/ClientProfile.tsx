import { useState } from 'react';
import { ArrowLeft, User, Mail, Phone, Calendar, Clock, Briefcase, Edit2, Trash2 } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { SessionDetailModal } from './SessionDetailModal';
import { BookingModal } from './BookingModal';
import { db } from '../firebase';
import { doc, updateDoc, writeBatch, collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { SITE_ID } from '../constants';

interface ClientProfileProps {
    onBack: () => void;
    client: {
        id: string;
        name: string;
        email: string;
        phone: string;
        joined: string;
    };
}

export const ClientProfile = ({ onBack, client }: ClientProfileProps) => {
    const { data: sessions } = useFirestore<any>('sessions');
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [editingSession, setEditingSession] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(client.name);
    const [editEmail, setEditEmail] = useState(client.email);
    const [editPhone, setEditPhone] = useState(client.phone);
    const { profile } = useAuth();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Filter sessions for this client
    const clientSessions = sessions.filter(s => s.clientName === client.name);
    const upcomingSessions = clientSessions
        .filter(s => new Date(s.date) >= today)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const pastSessions = clientSessions
        .filter(s => new Date(s.date) < today)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const displaySessions = tab === 'upcoming' ? upcomingSessions : pastSessions;

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    };

    const handleSaveEdit = async () => {
        try {
            await updateDoc(doc(db, 'clients', client.id), {
                name: editName,
                email: editEmail,
                phone: editPhone
            });
            setIsEditing(false);
            alert('Client updated successfully!');
        } catch (err) {
            console.error('Error updating client:', err);
            alert('Failed to update client.');
        }
    };

    const handleDeleteClient = async () => {
        if (window.confirm(`Are you sure you want to delete ${client.name}? This will also cancel all ${upcomingSessions.length} future bookings.`)) {
            try {
                const batch = writeBatch(db);

                // Delete the client document
                batch.delete(doc(db, 'clients', client.id));

                // Delete all future sessions
                upcomingSessions.forEach(session => {
                    batch.delete(doc(db, 'sessions', session.id));
                });

                await batch.commit();

                // Log activities for session cancellations
                const logPromises = upcomingSessions.map(session =>
                    addDoc(collection(db, 'activity_logs'), {
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
                    })
                );

                if (logPromises.length > 0) {
                    await Promise.all(logPromises);
                }

                alert('Client and future bookings deleted.');
                onBack();
            } catch (err) {
                console.error('Error deleting client and sessions:', err);
                alert('Failed to delete client.');
            }
        }
    };

    return (
        <div style={{ padding: window.innerWidth <= 768 ? '24px 16px' : '40px', maxWidth: '1000px', margin: '0 auto' }}>
            <button
                onClick={onBack}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    marginBottom: '32px',
                    fontWeight: 700,
                    padding: 0
                }}
            >
                <ArrowLeft size={18} />
                Back to Clients
            </button>

            {/* Client Info Card */}
            <div className="card" style={{ padding: window.innerWidth <= 768 ? '20px' : '32px', marginBottom: '32px' }}>
                <div style={{
                    display: 'flex',
                    gap: window.innerWidth <= 768 ? '16px' : '24px',
                    alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                    flexDirection: window.innerWidth <= 768 ? 'column' : 'row'
                }}>
                    <div style={{
                        width: window.innerWidth <= 768 ? '60px' : '80px',
                        height: window.innerWidth <= 768 ? '60px' : '80px',
                        background: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        flexShrink: 0
                    }}>
                        <User size={36} />
                    </div>
                    {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{ padding: '8px 12px', border: '2px solid #000', fontWeight: 700, fontSize: '1.1rem' }}
                                placeholder="Name"
                            />
                            <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                style={{ padding: '8px 12px', border: '2px solid #000', fontSize: '0.9rem' }}
                                placeholder="Email"
                            />
                            <input
                                type="tel"
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                style={{ padding: '8px 12px', border: '2px solid #000', fontSize: '0.9rem' }}
                                placeholder="Phone"
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="button-primary" onClick={handleSaveEdit} style={{ padding: '8px 20px' }}>
                                    Save
                                </button>
                                <button className="button-secondary" onClick={() => { setIsEditing(false); setEditName(client.name); setEditEmail(client.email); setEditPhone(client.phone); }} style={{ padding: '8px 20px' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h2 style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{client.name}</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                    <Mail size={16} className="text-muted" />
                                    <span>{client.email}</span>
                                </div>
                                {client.phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                        <Phone size={16} className="text-muted" />
                                        <span>{client.phone}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                    <Calendar size={16} className="text-muted" />
                                    <span className="text-muted">Joined {client.joined}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {!isEditing && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="button-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
                        >
                            <Edit2 size={16} /> Edit
                        </button>
                        <button
                            onClick={handleDeleteClient}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 16px', background: '#ff4444', color: '#fff',
                                border: 'none', fontWeight: 700, cursor: 'pointer'
                            }}
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                )}
            </div>

            {/* Stats Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '32px'
            }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>UPCOMING</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800 }}>{upcomingSessions.length}</p>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>PAST SESSIONS</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800 }}>{pastSessions.length}</p>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>TOTAL</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800 }}>{clientSessions.length}</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '24px',
                borderBottom: '2px solid #eee',
                paddingBottom: '16px',
                overflowX: 'auto'
            }}>
                <button
                    onClick={() => setTab('upcoming')}
                    style={{
                        padding: window.innerWidth <= 768 ? '8px 16px' : '8px 24px',
                        background: tab === 'upcoming' ? '#000' : 'transparent',
                        color: tab === 'upcoming' ? '#fff' : '#666',
                        border: 'none',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Upcoming ({upcomingSessions.length})
                </button>
                <button
                    onClick={() => setTab('past')}
                    style={{
                        padding: window.innerWidth <= 768 ? '8px 16px' : '8px 24px',
                        background: tab === 'past' ? '#000' : 'transparent',
                        color: tab === 'past' ? '#fff' : '#666',
                        border: 'none',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Past ({pastSessions.length})
                </button>
            </div>

            {/* Session List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displaySessions.length > 0 ? displaySessions.map((session) => (
                    <div
                        key={session.id}
                        className="card card-hover"
                        onClick={() => setSelectedSession(session)}
                        style={{
                            padding: '20px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                    >
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                background: tab === 'upcoming' ? '#000' : '#f0f0f0',
                                color: tab === 'upcoming' ? '#fff' : '#666',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Calendar size={20} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>
                                    {formatDate(session.date)}
                                </div>
                                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={14} className="text-muted" />
                                        {session.time}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Briefcase size={14} className="text-muted" />
                                        {session.trainerName}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{session.serviceName}</div>
                            <div style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: session.status === 'Scheduled' ? '#4caf50' : '#666',
                                marginTop: '4px'
                            }}>
                                {session.status}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div style={{ padding: '60px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #ccc' }}>
                        <Calendar size={48} style={{ margin: '0 auto 16px', color: '#ccc' }} />
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
                            {tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
                        </h3>
                        <p className="text-muted">
                            {tab === 'upcoming' ? 'Book a session for this client from the calendar.' : 'Session history will appear here.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Session Detail Modal (for reschedule/delete) */}
            {selectedSession && (
                <SessionDetailModal
                    isOpen={!!selectedSession}
                    onClose={() => setSelectedSession(null)}
                    session={selectedSession}
                    onDelete={() => {
                        setSelectedSession(null);
                    }}
                    onReschedule={(session) => {
                        setSelectedSession(null);
                        setEditingSession(session);
                    }}
                />
            )}

            {/* Booking Modal (for reschedule) */}
            {editingSession && (
                <BookingModal
                    isOpen={!!editingSession}
                    onClose={() => setEditingSession(null)}
                    selectedSlot={{ day: editingSession.day, time: editingSession.time, date: new Date(editingSession.date) }}
                    editingSession={editingSession}
                    onBook={() => {
                        setEditingSession(null);
                    }}
                />
            )}
        </div>
    );
};
