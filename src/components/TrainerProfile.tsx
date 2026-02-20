import { useState } from 'react';
import { ArrowLeft, User, Mail, Calendar, Star, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface TrainerProfileProps {
    onBack: () => void;
    trainer: any;
    onEdit: (trainer: any) => void;
    onDelete: (id: string) => void;
}

export const TrainerProfile = ({ onBack, trainer, onEdit, onDelete }: TrainerProfileProps) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { profile } = useAuth();
    const isManager = profile?.role === 'manager';
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
                        !isManager && (
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Mail size={18} className="text-muted" />
                                <span style={{ fontSize: '0.9rem' }}>{trainer.name.toLowerCase().replace(' ', '.')}@invictus.com</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Star size={18} className="text-muted" />
                                <span style={{ fontSize: '0.9rem' }}>4.9 Rating (120 reviews)</span>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Availability</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                const dayData = trainer.availability?.[day];
                                if (!dayData || !dayData.active) return null;
                                return (
                                    <div key={day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                        <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{day}</span>
                                        <span>{dayData.start} - {dayData.end}</span>
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
                            <div style={{
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
                                        <h4 style={{ fontWeight: 700 }}>Emma Watson</h4>
                                        <p style={{ fontSize: '0.8rem' }} className="text-muted">Personal Training</p>
                                    </div>
                                </div>
                                <div style={{ background: '#000', color: '#fff', padding: '6px 12px', borderRadius: 0, fontSize: '0.8rem', fontWeight: 700 }}>
                                    Today, 4:00 PM
                                </div>
                            </div>
                            {/* More items... */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
