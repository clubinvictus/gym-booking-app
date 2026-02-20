import { Search, Plus, Filter, MoreVertical } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';

interface ClientManagementProps {
    onClientClick: (client: any) => void;
}

export const ClientManagement = ({ onClientClick }: ClientManagementProps) => {
    const { data: clients, loading } = useFirestore<any>('clients');

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p className="text-muted">Loading clients...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Clients</h1>
                    <p className="text-muted">Manage your member database</p>
                </div>
                <button className="button-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={18} />
                    New Client
                </button>
            </header>

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '2px solid #f0f0f0', display: 'flex', gap: '16px' }}>
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
                    <button className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={18} />
                        Filters
                    </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9f9f9' }}>
                            <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Client Name</th>
                            <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Contact</th>
                            <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Joined Date</th>
                            <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Status</th>
                            <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.map((client) => (
                            <tr key={client.id} style={{ borderTop: '1px solid #f0f0f0' }}>
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
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="button-secondary"
                                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                            onClick={() => onClientClick(client)}
                                        >
                                            View Profile
                                        </button>
                                        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><MoreVertical size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
