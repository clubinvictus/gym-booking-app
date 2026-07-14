import { useState } from 'react';
import { ArrowLeft, User, Mail, Calendar, Star, Edit2, Trash2, Phone, AlertCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useConfirm } from '../ConfirmContext';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { SITE_ID } from '../constants';
import { useSessions } from '../hooks/useSessions';
import { BookingModal } from './BookingModal';

interface TrainerProfileProps {
    onBack: () => void;
    trainer: any;
    onEdit: (trainer: any) => void;
    onDelete: (id: string) => void;
}

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const TrainerProfile = ({ onBack, trainer, onEdit, onDelete }: TrainerProfileProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(trainer.name);
    const [editRole, setEditRole] = useState(trainer.role || 'trainer');
    const [editPhone, setEditPhone] = useState(trainer.phone || '');
    const [phoneError, setPhoneError] = useState('');
    const { user, profile } = useAuth();
    const confirm = useConfirm();
    const isManager = profile?.role === 'manager';

    // Reassign flow state — mirrors CalendarView's off-day "Reschedule" mechanism
    // (excludedTrainerId + BookingModal with editingSession) rather than a bespoke picker.
    const [reassignSlot, setReassignSlot] = useState<any>(null);
    const [reassignSession, setReassignSession] = useState<any>(null);

    const { sessions, loading: sessionsLoading, hasMore, loadMore } = useSessions({
        role: profile?.role as any,
        userId: user?.uid || '',
        trainerId: trainer.id,
        pageSize: 50
    });

    const upcomingSessions = sessions
        .filter((s: any) => s.status !== 'Cancelled' && (s.date || '') >= todayStr())
        .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)));

    const handleDeleteClick = async () => {
        const confirmed = await confirm({
            title: 'Delete Trainer?',
            message: 'This trainer will no longer be bookable for new sessions. If they have any booking history, they\'ll be deactivated instead of deleted — any active recurring series will be cancelled, and you\'ll be able to resolve their upcoming sessions below.',
            confirmLabel: 'Continue',
            type: 'danger'
        });
        if (confirmed) onDelete(trainer.id);
    };

    const handleCancelSession = async (session: any) => {
        const confirmed = await confirm({
            title: 'Cancel Session?',
            message: `Are you sure you want to cancel the session for ${session.clientName || 'Group'} at ${session.time}? This action cannot be undone.`,
            confirmLabel: 'Yes, Cancel',
            type: 'danger'
        });
        if (!confirmed) return;

        try {
            await deleteDoc(doc(db, 'sessions', session.id));
            await addDoc(collection(db, 'activity_logs'), {
                action: 'cancelled',
                sessionDetails: {
                    clientName: session.clientName || session.clients?.map((c: any) => c.name).join(', ') || 'Group',
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
        } catch (error) {
            console.error('Error cancelling session:', error);
            alert('Failed to cancel session.');
        }
    };

    const handleReassignClick = (session: any) => {
        setReassignSession(session);
        setReassignSlot({
            day: session.day,
            time: session.time,
            trainerId: session.trainerId,
            date: session.date ? new Date(session.date) : new Date()
        });
    };

    const handleSaveEdit = async () => {
        // E.164 basic validation
        const phoneRegex = /^\+[1-9]\d{10,14}$/;
        if (editPhone && !phoneRegex.test(editPhone.replace(/\s+/g, ''))) {
            setPhoneError('Phone number must start with a + country code and contain 10-15 digits (e.g., +1234567890).');
            return;
        }

        try {
            await updateDoc(doc(db, 'trainers', trainer.id), {
                name: editName,
                role: editRole,
                phone: editPhone ? editPhone.replace(/\s+/g, '') : ''
            });

            // If updating a trainer to manager role, make sure they are included in users collection correctly
            // (Note: full role sync usually happens via AdminDashboard cloud functions or specific hooks, 
            // but we at least update the trainer doc here)

            setIsEditing(false);
            setPhoneError('');
        } catch (err) {
            console.error('Error updating trainer:', err);
            alert('Failed to update trainer.');
        }
    };

    return (
        <div style={{ padding: '40px' }}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '32px'
                }}
            >
                <button
                    onClick={onBack}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        padding: 0
                    }}
                >
                    <ArrowLeft size={18} />
                    Back to Trainers
                </button>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {
                        isManager ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {isEditing ? (
                                    <>
                                        <button className="button-primary" onClick={handleSaveEdit} style={{ padding: '8px 16px' }}>Save</button>
                                        <button
                                            className="button-secondary"
                                            onClick={() => {
                                                setIsEditing(false);
                                                setEditName(trainer.name);
                                                setEditRole(trainer.role || 'trainer');
                                                setEditPhone(trainer.phone || '');
                                                setPhoneError('');
                                            }}
                                            style={{ padding: '8px 16px' }}
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className="button-secondary"
                                            onClick={() => setIsEditing(true)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 16px'
                                            }}
                                        >
                                            <Edit2 size={16} /> Edit
                                        </button>
                                        <button
                                            onClick={handleDeleteClick}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 16px',
                                                background: '#ff4444',
                                                color: '#fff',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontWeight: 700
                                            }}
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onEdit(trainer); }}
                                    className="button-secondary"
                                    style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <Edit2 size={16} /> Edit Profile
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: '#ff4444',
                                        color: '#fff',
                                        border: 'none',
                                        cursor: 'pointer',
                                        borderRadius: 0,
                                        fontWeight: 700
                                    }}
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            </>
                        )
                    }
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px' }}>
                {/* Left Column - Info Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            background: '#000',
                            borderRadius: 0,
                            margin: '0 auto 24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff'
                        }}>
                            <User size={60} />
                        </div>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{trainer.name}</h2>
                        <div style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            background: trainer.status === 'Active' ? '#000' : '#f0f0f0',
                            color: trainer.status === 'Active' ? '#fff' : '#666',
                            borderRadius: 0,
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            marginBottom: '24px'
                        }}>
                            {trainer.status === 'Inactive' ? 'Inactive — not bookable' : trainer.status}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <input
                                        type="tel"
                                        value={editPhone}
                                        required
                                        onChange={(e) => {
                                            setEditPhone(e.target.value);
                                            setPhoneError('');
                                        }}
                                        style={{ padding: '8px 12px', border: phoneError ? '2px solid #ff4444' : '2px solid #000', fontSize: '0.9rem', width: '100%' }}
                                        placeholder="Phone (e.g., +1234567890)"
                                    />
                                    {phoneError && (
                                        <p style={{ color: '#ff4444', fontSize: '0.8rem', fontWeight: 600, margin: '0' }}>
                                            {phoneError}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Mail size={18} className="text-muted" />
                                        <span style={{ fontSize: '0.9rem' }}>{trainer.name.toLowerCase().replace(' ', '.')}@invictus.com</span>
                                    </div>
                                    {trainer.phone && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Phone size={18} className="text-muted" />
                                            <span style={{ fontSize: '0.9rem' }}>{trainer.phone}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Star size={18} className="text-muted" />
                                        <span style={{ fontSize: '0.9rem' }}>4.9 Rating (120 reviews)</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Availability</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                const dayData = trainer.availability?.[day];
                                if (!dayData || !dayData.active || !dayData.shifts) return null;
                                return (
                                    <div key={day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', alignItems: 'flex-start' }}>
                                        <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{day}</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                                            {dayData.shifts.map((shift: any, idx: number) => (
                                                <span key={idx} style={{ fontWeight: 600 }}>
                                                    {shift.start} - {shift.end}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column - Activity & More */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card" style={{ padding: '32px' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Monthly Performance</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                            <div style={{ border: '2px solid #000', padding: '20px', borderRadius: '12px' }}>
                                <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>SESSIONS</p>
                                <p style={{ fontSize: '1.8rem', fontWeight: 800 }}>{trainer.sessions}</p>
                            </div>
                            <div style={{ border: '2px solid #000', padding: '20px', borderRadius: '12px' }}>
                                <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>CLIENTS</p>
                                <p style={{ fontSize: '1.8rem', fontWeight: 800 }}>12</p>
                            </div>
                            <div style={{ border: '2px solid #000', padding: '20px', borderRadius: '12px' }}>
                                <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>CONVERSION</p>
                                <p style={{ fontSize: '1.8rem', fontWeight: 800 }}>85%</p>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '32px' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Upcoming Sessions</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {sessionsLoading ? (
                                <p className="text-muted">Loading sessions...</p>
                            ) : sessions.length > 0 ? sessions.map((session: any) => (
                                <div key={session.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '16px',
                                    background: '#f9f9f9',
                                    borderRadius: 0,
                                    border: '2px solid #f0f0f0'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <Calendar size={20} />
                                        <div>
                                            <h4 style={{ fontWeight: 700 }}>{session.clientName}</h4>
                                            <p style={{ fontSize: '0.8rem' }} className="text-muted">{session.serviceName}</p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ background: '#000', color: '#fff', padding: '6px 12px', borderRadius: 0, fontSize: '0.75rem', fontWeight: 700 }}>
                                            {session.startTime?.toDate ? session.startTime.toDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : session.date}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, marginTop: '4px' }}>{session.time}</div>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-muted">No upcoming sessions scheduled.</p>
                            )}
                            {hasMore && !sessionsLoading && (
                                <button
                                    onClick={loadMore}
                                    className="button-secondary"
                                    style={{ padding: '10px 16px', fontSize: '0.85rem', alignSelf: 'center' }}
                                >
                                    Load more
                                </button>
                            )}
                        </div>
                    </div>

                    {trainer.status === 'Inactive' && upcomingSessions.length > 0 && (
                        <div className="card" style={{ padding: '32px', border: '2px solid #ff4444' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <AlertCircle size={22} color="#ff4444" />
                                <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Resolve Upcoming Sessions</h3>
                            </div>
                            <p className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '20px' }}>
                                This trainer is inactive. Reassign or cancel their remaining sessions below, or leave them to resolve later.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {upcomingSessions.map((session: any) => {
                                    const dateObj = session.date ? new Date(session.date) : null;
                                    const formattedDate = dateObj
                                        ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                        : '';
                                    return (
                                        <div
                                            key={session.id}
                                            style={{
                                                padding: '16px',
                                                border: '2px solid #000',
                                                display: 'flex',
                                                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                                                justifyContent: 'space-between',
                                                alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                                                gap: '16px',
                                                background: '#fcfcfc'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '4px' }}>
                                                    {formattedDate} at {session.time} — {session.clientName || 'Group'}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>
                                                    {session.serviceName}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', width: window.innerWidth <= 768 ? '100%' : 'auto' }}>
                                                <button
                                                    onClick={() => handleReassignClick(session)}
                                                    className="button-secondary"
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        fontSize: '0.8rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <Edit2 size={14} />
                                                    Reassign
                                                </button>
                                                <button
                                                    onClick={() => handleCancelSession(session)}
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        background: '#fff5f5',
                                                        color: '#f44336',
                                                        border: '2px solid #f44336',
                                                        fontWeight: 800,
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <BookingModal
                isOpen={!!reassignSlot}
                onClose={() => { setReassignSlot(null); setReassignSession(null); }}
                selectedSlot={reassignSlot}
                editingSession={reassignSession}
                excludedTrainerId={trainer.id}
                onBook={() => { setReassignSlot(null); setReassignSession(null); }}
            />
        </div>
    );
};
