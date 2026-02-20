import { useState } from 'react';
import { Plus, User, Trash2, Mail, Shield } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { useAuth } from '../AuthContext';

interface TeamManagementProps {
    onTrainerClick: (trainer: any) => void;
    onAddTrainerClick: () => void;
    onAddManagerClick: () => void;
    onDeleteManagerClick: (managerId: string) => Promise<void>;
}

export const TeamManagement = ({ onTrainerClick, onAddTrainerClick, onAddManagerClick, onDeleteManagerClick }: TeamManagementProps) => {
    const { data: trainers, loading: trainersLoading, error: trainersError } = useFirestore<any>('trainers');
    const { data: managers, loading: managersLoading, error: managersError } = useFirestore<any>('managers');
    const { profile } = useAuth();
    const isManager = profile?.role === 'manager';
    const [view, setView] = useState<'trainers' | 'managers'>('trainers');

    if (trainersLoading || managersLoading) return <div style={{ padding: '40px' }}>Loading...</div>;
    if (trainersError || managersError) return <div style={{ padding: '40px', color: 'red' }}>Error loading data.</div>;

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Team</h1>
                    <p className="text-muted">Manage your trainers and managers</p>
                </div>
                {!isManager && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onAddTrainerClick} className="button-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={20} />
                            Add Trainer
                        </button>
                        <button onClick={onAddManagerClick} className="button-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#333' }}>
                            <Shield size={20} />
                            Add Manager
                        </button>
                    </div>
                )}
            </header>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '2px solid #eee', paddingBottom: '16px' }}>
                <button
                    onClick={() => setView('trainers')}
                    style={{
                        padding: '8px 24px',
                        background: view === 'trainers' ? '#000' : 'transparent',
                        color: view === 'trainers' ? '#fff' : '#666',
                        border: 'none',
                        borderRadius: '24px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Trainers
                </button>
                <button
                    onClick={() => setView('managers')}
                    style={{
                        padding: '8px 24px',
                        background: view === 'managers' ? '#000' : 'transparent',
                        color: view === 'managers' ? '#fff' : '#666',
                        border: 'none',
                        borderRadius: '24px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Managers
                </button>
            </div>

            {view === 'trainers' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                    {trainers.map(trainer => (
                        <div
                            key={trainer.id}
                            className="card card-hover"
                            onClick={() => onTrainerClick(trainer)}
                            style={{ padding: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px' }}
                        >
                            <img
                                src={trainer.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(trainer.name)}&background=000&color=fff`}
                                alt={trainer.name}
                                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <div>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{trainer.name}</h3>
                                <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                                    {trainer.specialties?.join(', ') || 'General Fitness'}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: trainer.status === 'Active' ? '#4caf50' : '#ff4444' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: trainer.status === 'Active' ? '#4caf50' : '#ff4444' }} />
                                    {trainer.status}
                                </div>
                            </div>
                        </div>
                    ))}
                    {trainers.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #ccc' }}>
                            <User size={48} style={{ margin: '0 auto 16px', color: '#ccc' }} />
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No trainers found</h3>
                            <p className="text-muted">Add your first trainer to get started.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {managers.map(manager => (
                        <div
                            key={manager.id}
                            className="card"
                            style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ width: '64px', height: '64px', background: '#f5f5f5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Shield size={24} color="#000" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{manager.name}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#666' }}>
                                        <Mail size={16} />
                                        {manager.email}
                                    </div>
                                </div>
                            </div>
                            {!isManager && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteManagerClick(manager.id); }}
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        border: 'none',
                                        background: '#fff5f5',
                                        color: '#ff4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                    title="Remove Manager"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    ))}
                    {managers.length === 0 && (
                        <div style={{ padding: '60px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #ccc' }}>
                            <Shield size={48} style={{ margin: '0 auto 16px', color: '#ccc' }} />
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No managers found</h3>
                            <p className="text-muted">Add administrative managers here.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
