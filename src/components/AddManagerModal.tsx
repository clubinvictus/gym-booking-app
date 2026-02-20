import { useState } from 'react';
import { X, User, Mail, Shield } from 'lucide-react';

interface AddManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (managerData: any) => Promise<void>;
}

export const AddManagerModal = ({ isOpen, onClose, onAdd }: AddManagerModalProps) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onAdd({ name, email });
            setName('');
            setEmail('');
            onClose();
        } catch (error) {
            console.error('Error adding manager:', error);
        } finally {
            setIsSubmitting(false);
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
                maxWidth: '500px',
                padding: '40px',
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '48px', height: '48px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <Shield size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '0' }}>Add Manager</h2>
                        <p className="text-muted" style={{ marginTop: '4px' }}>Create a new admin-level user</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>FULL NAME</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '14px' }}><User size={18} className="text-muted" /></div>
                            <input
                                type="text"
                                required
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
                                placeholder="Jane Doe"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>EMAIL ADDRESS</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '14px' }}><Mail size={18} className="text-muted" /></div>
                            <input
                                type="email"
                                required
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
                                placeholder="jane@invictus.com"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="button-primary"
                        style={{ height: '54px', fontSize: '1.1rem', marginTop: '16px', opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'wait' : 'pointer' }}
                    >
                        {isSubmitting ? 'Adding...' : 'Add Manager'}
                    </button>
                </form>
            </div>
        </div>
    );
};
