import { Plus, Clock, Edit2, Trash2, AlertTriangle, X } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useState } from 'react';

import { useAuth } from '../AuthContext';

interface ServiceManagementProps {
    onAddClick: () => void;
    onEditClick?: (service: any) => void;
}

export const ServiceManagement = ({ onAddClick, onEditClick }: ServiceManagementProps) => {
    const { data: services, loading } = useFirestore<any>('services');
    const [serviceToDelete, setServiceToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { profile } = useAuth();
    const isManager = profile?.role === 'manager';

    const performDelete = async () => {
        if (!serviceToDelete) return;

        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'services', serviceToDelete.id));
            setServiceToDelete(null);
        } catch (error) {
            console.error('Error deleting service:', error);
            alert('Failed to delete service.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p className="text-muted">Loading services...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Services</h1>
                    <p className="text-muted">Configure your studio's offerings</p>
                </div>
                {!isManager && (
                    <button
                        className="button-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={onAddClick}
                    >
                        <Plus size={18} />
                        New Service
                    </button>
                )}
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {services.map(service => (
                    <div key={service.id} className="card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>{service.name}</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={16} className="text-muted" />
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{service.duration} minutes</span>
                            </div>
                        </div>

                        <div style={{
                            borderTop: '2px solid #f0f0f0',
                            paddingTop: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>{service.trainers || 'Multiple'} Trainers assigned</span>
                            {!isManager && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        className="button-secondary"
                                        style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        onClick={() => onEditClick?.(service)}
                                    >
                                        <Edit2 size={14} /> Edit
                                    </button>
                                    <button
                                        style={{
                                            padding: '8px 12px',
                                            fontSize: '0.8rem',
                                            background: '#fff',
                                            border: '1px solid #ff4444',
                                            color: '#ff4444',
                                            fontWeight: 800,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setServiceToDelete(service)}
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Deletion Confirmation Modal */}
            {serviceToDelete && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(8px)',
                    padding: '20px'
                }}>
                    <div className="card" style={{
                        maxWidth: '400px',
                        width: '100%',
                        padding: '32px',
                        background: '#fff',
                        border: '4px solid #000',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            background: '#fff',
                            border: '4px solid #ff4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px',
                            color: '#ff4444'
                        }}>
                            <AlertTriangle size={32} />
                        </div>

                        <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Delete Service?</h2>
                        <p className="text-muted" style={{ marginBottom: '32px', lineHeight: '1.5' }}>
                            Are you sure you want to delete <strong>"{serviceToDelete.name}"</strong>? This will remove it from all trainer profiles and cannot be undone.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                className="button-primary"
                                style={{ background: '#ff4444', border: 'none', padding: '16px' }}
                                onClick={performDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'DELETING...' : 'YES, DELETE SERVICE'}
                            </button>
                            <button
                                className="button-secondary"
                                style={{ padding: '16px' }}
                                onClick={() => setServiceToDelete(null)}
                                disabled={isDeleting}
                            >
                                CANCEL
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
