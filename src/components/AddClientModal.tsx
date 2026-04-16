import { useState } from 'react';
import { X, User, Mail, Phone } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface AddClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (client: any) => void;
}

export const AddClientModal = ({ isOpen, onClose, onAdd }: AddClientModalProps) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [countryCode, setCountryCode] = useState('+91');
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [membershipTier, setMembershipTier] = useState('limitless');
    const { profile } = useAuth();

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // E.164 basic validation: starts with +, then up to 15 digits
        const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
        const phoneRegex = /^\+[1-9]\d{6,14}$/;
        if (!phoneRegex.test(fullPhone)) {
            setPhoneError('Invalid phone number format.');
            return;
        }

        onAdd({
            name,
            email,
            phone: fullPhone,
            membership_tier: membershipTier,
            joined: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });

        // Reset fields
        setName('');
        setEmail('');
        setPhone('');
        setCountryCode('+91');
        setPhoneError('');
        setMembershipTier('limitless');
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
                                        setPhone(e.target.value.replace(/\D/g, ''));
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
                                    placeholder="Phone Number"
                                />
                                {phoneError && (
                                    <p style={{ color: '#ff4444', fontSize: '0.8rem', fontWeight: 600, margin: '4px 0 0 0', position: 'absolute' }}>
                                        {phoneError}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>MEMBERSHIP TIER</label>
                        <select
                            value={membershipTier}
                            onChange={(e) => setMembershipTier(e.target.value)}
                            disabled={profile?.role !== 'admin' && profile?.role !== 'manager'}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: 0,
                                border: '2px solid #000',
                                fontSize: '1rem',
                                fontWeight: 600,
                                backgroundColor: (profile?.role !== 'admin' && profile?.role !== 'manager') ? '#f5f5f5' : '#fff',
                                cursor: (profile?.role !== 'admin' && profile?.role !== 'manager') ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <option value="limitless">Limitless (1-on-1)</option>
                            <option value="limitless_open">Limitless Open (Shared)</option>
                        </select>
                        <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '6px' }}>
                            {membershipTier === 'limitless' ? 'Standard premium membership.' : 'Open tier membership with extended access.'}
                        </p>
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
