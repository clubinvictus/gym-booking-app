import { useState } from 'react';
import { ArrowLeft, User, Mail, Calendar, Star, Edit2, Trash2, AlertTriangle, Phone } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useSessions } from '../hooks/useSessions';

interface TrainerProfileProps {
    onBack: () => void;
    trainer: any;
    onEdit: (trainer: any) => void;
    onDelete: (id: string) => void;
}

export const TrainerProfile = ({ onBack, trainer, onEdit, onDelete }: TrainerProfileProps) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(trainer.name);
    const [editRole, setEditRole] = useState(trainer.role || 'trainer');
    const [editPhone, setEditPhone] = useState(trainer.phone || '');
    const [phoneError, setPhoneError] = useState('');
    const { user, profile } = useAuth();
    const isManager = profile?.role === 'manager';

    const { sessions, loading: sessionsLoading } = useSessions({
        role: profile?.role as any,
        userId: user?.uid || '',
        trainerId: trainer.id,
        pageSize: 10
    });

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
                    {showDeleteConfirm ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fff1f1', padding: '8px 16px', border: '2px solid #ff4444' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4444', fontWeight: 800, fontSize: '0.85rem' }}>
                                <AlertTriangle size={18} />
                                CONFIRM DELETE?
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onDelete(trainer.id); }}
                                    style={{
                                        padding: '6px 16px',
                                        background: '#ff4444',
                                        color: '#fff',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: 800,
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    YES, DELETE
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                                    className="button-secondary"
                                    style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                                >
                                    CANCEL
                                </button>
                            </div>
                        </div>
                    ) : (
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
                                            onClick={() => setShowDeleteConfirm(true)}
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
                                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
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
                    )}
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
                            {trainer.status}
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
