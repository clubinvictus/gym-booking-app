import { useState, useEffect } from 'react';
import { X, User, Mail, Shield } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

interface AddTrainerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (trainer: any) => void;
}

export const AddTrainerModal = ({ isOpen, onClose, onAdd }: AddTrainerModalProps) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
    const [services, setServices] = useState<any[]>([]);

    useEffect(() => {
        const fetchServices = async () => {
            const querySnapshot = await getDocs(collection(db, 'services'));
            setServices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        if (isOpen) fetchServices();
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleSpecialty = (s: string) => {
        if (selectedSpecialties.includes(s)) {
            setSelectedSpecialties(selectedSpecialties.filter(item => item !== s));
        } else {
            setSelectedSpecialties([...selectedSpecialties, s]);
        }
    };

    const handleSubmit = () => {
        onAdd({
            name,
            email,
            specialties: selectedSpecialties
        });
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
                maxWidth: '500px',
                padding: '32px',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                    <X size={24} />
                </button>

                <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Add New Trainer</h2>
                <p className="text-muted" style={{ marginBottom: '24px' }}>Add a new coach to the Invictus team.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>FULL NAME</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '14px' }}><User size={18} className="text-muted" /></div>
                            <input
                                type="text"
                                placeholder="e.g. John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 48px',
                                    borderRadius: 0,
                                    border: '2px solid #000',
                                    fontSize: '1rem',
                                    fontWeight: 600
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>EMAIL ADDRESS</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '14px' }}><Mail size={18} className="text-muted" /></div>
                            <input
                                type="email"
                                placeholder="john@invictus.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 48px',
                                    borderRadius: 0,
                                    border: '2px solid #000',
                                    fontSize: '1rem',
                                    fontWeight: 600
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>QUALIFIED SERVICES</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {services.map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => toggleSpecialty(s.name)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: 0,
                                        border: '2px solid #000',
                                        background: selectedSpecialties.includes(s.name) ? '#000' : '#fff',
                                        color: selectedSpecialties.includes(s.name) ? '#fff' : '#000',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        marginTop: '12px',
                        padding: '16px',
                        background: '#f9f9f9',
                        borderRadius: 0,
                        border: '2px solid #f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <Shield size={20} />
                        <p style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>Trainer will be automatically activated when they sign in with this email address.</p>
                    </div>

                    <button
                        className="button-primary"
                        style={{ width: '100%', padding: '16px' }}
                        onClick={handleSubmit}
                    >
                        Add Trainer
                    </button>
                </div>
            </div>
        </div>
    );
};
