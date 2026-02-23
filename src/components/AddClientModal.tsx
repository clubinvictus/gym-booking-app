import { useState } from 'react';
import { X, User, Mail, Phone } from 'lucide-react';

interface AddClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (client: any) => void;
}

export const AddClientModal = ({ isOpen, onClose, onAdd }: AddClientModalProps) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({
            name,
            email,
            phone,
            joined: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
        // Reset fields
        setName('');
        setEmail('');
        setPhone('');
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
                maxWidth: '450px',
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

                <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Add New Client</h2>
                <p className="text-muted" style={{ marginBottom: '24px' }}>Register a new member to the studio.</p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>FULL NAME</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '14px' }}><User size={18} className="text-muted" /></div>
                            <input
                                type="text"
                                placeholder="e.g. Jane Doe"
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
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>EMAIL ADDRESS</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '14px' }}><Mail size={18} className="text-muted" /></div>
                            <input
                                type="email"
                                placeholder="jane@example.com"
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
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>PHONE NUMBER</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '14px' }}><Phone size={18} className="text-muted" /></div>
                            <input
                                type="tel"
                                placeholder="+1 (555) 000-0000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
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

                    <button
                        type="submit"
                        className="button-primary"
                        style={{ width: '100%', padding: '16px', marginTop: '12px' }}
                    >
                        Create Client Profile
                    </button>
                </form>
            </div>
        </div>
    );
};
