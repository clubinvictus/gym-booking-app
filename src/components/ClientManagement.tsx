import { Search, Plus, Filter } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';

interface ClientManagementProps {
    onClientClick: (client: any) => void;
    onAddClick: () => void;
}

export const ClientManagement = ({ onClientClick, onAddClick }: ClientManagementProps) => {
    const { data: clients, loading } = useFirestore<any>('clients');

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p className="text-muted">Loading clients...</p>
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
                    <h1 style={{ fontSize: window.innerWidth <= 768 ? '2rem' : '2.5rem', marginBottom: '8px' }}>Clients</h1>
                    <p className="text-muted">Manage your member database</p>
                </div>
                <button
                    onClick={onAddClick}
                    className="button-primary"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: window.innerWidth <= 768 ? '100%' : 'auto'
                    }}
                >
                    <Plus size={18} />
                    New Client
                </button>
            </header>

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{
                    padding: '20px',
                    borderBottom: '2px solid #f0f0f0',
                    display: 'flex',
                    flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                    gap: '16px'
                }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <div style={{ position: 'absolute', left: '12px', top: '10px' }}><Search size={18} className="text-muted" /></div>
                        <input type="text" placeholder="Search clients..." style={{
                            width: '100%',
                            padding: '10px 10px 10px 40px',
                            borderRadius: 0,
                            border: '2px solid #000',
                            fontSize: '0.9rem'
                        }} />
                    </div>
                    <button
                        className="button-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: window.innerWidth <= 768 ? '100%' : 'auto'
                        }}
                    >
                        <Filter size={18} />
                        Filters
                    </button>
                </div>

                {window.innerWidth <= 768 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {clients.map((client) => (
                            <div
                                key={client.id}
                                onClick={() => onClientClick(client)}
                                style={{
                                    padding: '20px',
                                    borderBottom: '1px solid #f0f0f0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', background: '#000', borderRadius: 0 }}></div>
                                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{client.name}</span>
                                </div>
                                <div style={{ fontSize: '0.9rem' }}>
                                    <div className="text-muted">{client.email}</div>
                                    <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>{client.phone}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>Joined {client.joined}</span>
                                    <span style={{
                                        background: '#000',
                                        color: '#fff',
                                        padding: '4px 10px',
                                        fontSize: '0.7rem',
                                        fontWeight: 700
                                    }}>Active</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9f9f9' }}>
                                <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Client Name</th>
                                <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Contact</th>
                                <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Joined Date</th>
                                <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((client) => (
                                <tr
                                    key={client.id}
                                    style={{ borderTop: '1px solid #f0f0f0', cursor: 'pointer', transition: 'background 0.15s ease' }}
                                    onClick={() => onClientClick(client)}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f9f9f9')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', background: '#000', borderRadius: 0 }}></div>
                                            <span style={{ fontWeight: 700 }}>{client.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', fontSize: '0.9rem' }}>
                                        <div className="text-muted">{client.email}</div>
                                        <div style={{ fontSize: '0.8rem' }}>{client.phone}</div>
                                    </td>
                                    <td style={{ padding: '16px 24px', fontSize: '0.9rem' }}>{client.joined}</td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{
                                            background: '#000',
                                            color: '#fff',
                                            padding: '4px 10px',
                                            borderRadius: 0,
                                            fontSize: '0.75rem',
                                            fontWeight: 700
                                        }}>Active</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
