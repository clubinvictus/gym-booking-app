import { ArrowLeft, User, Mail, Phone, Calendar, Clock, CreditCard, History } from 'lucide-react';

interface ClientProfileProps {
    onBack: () => void;
    client: {
        id: string;
        name: string;
        email: string;
        phone: string;
        joined: string;
    };
}

export const ClientProfile = ({ onBack, client }: ClientProfileProps) => {
    return (
        <div style={{ padding: '40px' }}>
            <button
                onClick={onBack}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    marginBottom: '32px',
                    fontWeight: 700,
                    padding: 0
                }}
            >
                <ArrowLeft size={18} />
                Back to Clients
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '40px' }}>
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card" style={{ padding: '32px' }}>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            background: '#000',
                            borderRadius: 0,
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff'
                        }}>
                            <User size={50} />
                        </div>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{client.name}</h2>
                        <p className="text-muted" style={{ marginBottom: '24px' }}>Member since {client.joined}</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Mail size={18} className="text-muted" />
                                <span style={{ fontSize: '0.9rem' }}>{client.email}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Phone size={18} className="text-muted" />
                                <span style={{ fontSize: '0.9rem' }}>{client.phone}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Plan Status</h3>
                        <div style={{ border: '2px solid #000', padding: '16px', borderRadius: 0, background: '#f9f9f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontWeight: 800 }}>PRO MEMBER</span>
                                <span style={{ background: '#000', color: '#fff', padding: '2px 8px', borderRadius: 0, fontSize: '0.7rem' }}>ACTIVE</span>
                            </div>
                            <p style={{ fontSize: '0.85rem' }} className="text-muted">Renews March 16, 2026</p>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                        <div className="card" style={{ padding: '24px' }}>
                            <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>NEXT SESSION</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={16} />
                                <span style={{ fontWeight: 700 }}>Tomorrow</span>
                            </div>
                            <p style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '8px' }}>4:00 PM</p>
                        </div>
                        <div className="card" style={{ padding: '24px' }}>
                            <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>TOTAL VISITS</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <History size={16} />
                                <span style={{ fontWeight: 700 }}>Lifetime</span>
                            </div>
                            <p style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '8px' }}>42</p>
                        </div>
                        <div className="card" style={{ padding: '24px' }}>
                            <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>BALANCE</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CreditCard size={16} />
                                <span style={{ fontWeight: 700 }}>USD</span>
                            </div>
                            <p style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '8px' }}>$0.00</p>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '2px solid #f0f0f0' }}>
                            <h3 style={{ fontSize: '1.2rem' }}>Session History</h3>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                {[
                                    { date: 'Feb 12, 2026', type: 'Personal Training', trainer: 'Alex Rivera', status: 'Completed' },
                                    { date: 'Feb 10, 2026', type: 'HIIT Class', trainer: 'Sarah Chen', status: 'Completed' },
                                    { date: 'Feb 05, 2026', type: 'Standard Check-in', trainer: '-', status: 'Completed' },
                                ].map((row, i) => (
                                    <tr key={i} style={{ borderBottom: i < 2 ? '1px solid #f0f0f0' : 'none' }}>
                                        <td style={{ padding: '16px 24px', fontSize: '0.9rem' }}>
                                            <span style={{ fontWeight: 700 }}>{row.date}</span>
                                        </td>
                                        <td style={{ padding: '16px 24px', fontSize: '0.9rem' }}>{row.type}</td>
                                        <td style={{ padding: '16px 24px', fontSize: '0.9rem' }} className="text-muted">{row.trainer}</td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                            <span style={{ color: '#000', fontWeight: 700, fontSize: '0.75rem' }}>{row.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
