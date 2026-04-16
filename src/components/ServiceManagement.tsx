import { Plus, Clock, Edit2, Trash2, User } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useConfirm } from '../ConfirmContext';
import { useAuth } from '../AuthContext';

interface ServiceManagementProps {
    onAddClick: () => void;
    onEditClick?: (service: any) => void;
}

export const ServiceManagement = ({ onAddClick, onEditClick }: ServiceManagementProps) => {
    const { data: services, loading } = useFirestore<any>('services');
    const confirm = useConfirm();
    const { profile } = useAuth();
    const isManager = profile?.role === 'manager';


    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p className="text-muted">Loading services...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: window.innerWidth <= 768 ? '24px 16px' : '40px' }}>
            <header style={{
                display: 'flex',
                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                marginBottom: '40px',
                gap: '20px'
            }}>
                <div>
                    <h1 style={{ fontSize: window.innerWidth <= 768 ? '2rem' : '2.5rem', marginBottom: '8px' }}>Services</h1>
                    <p className="text-muted">Configure your studio's offerings</p>
                </div>
                {!isManager && (
                    <button
                        className="button-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: window.innerWidth <= 768 ? '100%' : 'auto'
                        }}
                        onClick={onAddClick}
                    >
                        <Plus size={18} />
                        New Service
                    </button>
                )}
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '24px' }}>
                {services.map(service => (
                    <div key={service.id} className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div title={service.color || '#000000'} style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: service.color || '#000000',
                                border: '2px solid #000',
                                flexShrink: 0
                            }} />
                            <h3 style={{ fontSize: '1.4rem', margin: 0 }}>{service.name}</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={16} className="text-muted" />
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{service.duration} minutes</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <User size={16} className="text-muted" />
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Max Capacity: {service.max_capacity || 1}</span>
                            </div>
                            {service.allowed_tiers && service.allowed_tiers.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                    {service.allowed_tiers.map((tier: string) => (
                                        <span key={tier} style={{
                                            background: tier === 'limitless_open' ? '#f0cc00' : '#e0e0e0',
                                            color: '#000',
                                            padding: '4px 8px',
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            textTransform: 'uppercase'
                                        }}>
                                            {tier.replace('_', ' ')}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{
                            borderTop: '2px solid #f0f0f0',
                            paddingTop: '16px',
                            display: 'flex',
                            flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                            justifyContent: 'space-between',
                            alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                            gap: '12px'
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
                                        onClick={async () => {
                                            const confirmed = await confirm({
                                                title: 'Delete Service',
                                                message: `Are you sure you want to delete "${service.name}"? This will remove it from all trainer profiles and cannot be undone.`,
                                                confirmLabel: 'Delete Service',
                                                type: 'danger'
                                            });

                                            if (confirmed) {
                                                try {
                                                    await deleteDoc(doc(db, 'services', service.id));
                                                } catch (error) {
                                                    console.error('Error deleting service:', error);
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
