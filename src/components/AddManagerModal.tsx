import { useState } from 'react';
import { X, User, Mail, Shield, Phone } from 'lucide-react';

interface AddManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (managerData: any) => Promise<void>;
}

export const AddManagerModal = ({ isOpen, onClose, onAdd }: AddManagerModalProps) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [countryCode, setCountryCode] = useState('+91');
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // E.164 basic validation: starts with +, then up to 15 digits
        const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
        const phoneRegex = /^\+[1-9]\d{6,14}$/;
        if (!phoneRegex.test(fullPhone)) {
            setPhoneError('Invalid phone number format.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onAdd({ name, email, phone: fullPhone });
            setName('');
            setEmail('');
            setPhone('');
            setCountryCode('+91');
            setPhoneError('');
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

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>PHONE NUMBER</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                style={{
                                    padding: '12px',
                                    borderRadius: 0,
                                    border: '2px solid #000',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    width: '110px',
                                    backgroundColor: '#f9f9f9',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="+91">+91 (IN)</option>
                                <option value="+1">+1 (US/CA)</option>
                                <option value="+44">+44 (UK)</option>
                                <option value="+61">+61 (AU)</option>
                                <option value="+971">+971 (AE)</option>
                                <option value="+65">+65 (SG)</option>
                            </select>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <div style={{ position: 'absolute', left: '16px', top: '14px' }}><Phone size={18} className="text-muted" /></div>
                                <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={(e) => {
                                        setPhone(e.target.value);
                                        setPhoneError('');
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 48px',
                                        borderRadius: 0,
                                        border: phoneError ? '2px solid #ff4444' : '2px solid #000',
                                        fontSize: '1rem',
                                        fontWeight: 600
                                    }}
                                    placeholder="9876543210"
                                />
                            </div>
                        </div>
                        {phoneError && (
                            <div style={{ color: '#ff4444', fontSize: '0.85rem', marginTop: '6px', fontWeight: 600 }}>
                                {phoneError}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !!phoneError}
                        className="button-primary"
                        style={{ height: '54px', fontSize: '1.1rem', marginTop: '16px', opacity: (isSubmitting || !!phoneError) ? 0.7 : 1, cursor: (isSubmitting || !!phoneError) ? 'not-allowed' : 'pointer' }}
                    >
                        {isSubmitting ? 'Adding...' : 'Add Manager'}
                    </button>
                </form>
            </div>
        </div>
    );
};
