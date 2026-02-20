import { Calendar, User, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';

export const ActivityLogView = () => {
    const { data: logs, loading } = useFirestore<any>('activity_logs');

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p className="text-muted">Loading activity logs...</p>
            </div>
        );
    }

    // Sort logs descending by timestamp
    const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'booked': return <CheckCircle size={16} style={{ color: '#4caf50' }} />;
            case 'cancelled': return <XCircle size={16} style={{ color: '#f44336' }} />;
            case 'rescheduled': return <RefreshCw size={16} style={{ color: '#2196f3' }} />;
            default: return <Clock size={16} />;
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'booked': return '#e8f5e9';
            case 'cancelled': return '#ffebee';
            case 'rescheduled': return '#e3f2fd';
            default: return '#f5f5f5';
        }
    };

    const formatTimestamp = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Activity Log</h1>
                <p className="text-muted">Track booking changes and studio activity</p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {sortedLogs.length > 0 ? sortedLogs.map((log) => (
                    <div
                        key={log.id}
                        className="card"
                        style={{
                            padding: '20px',
                            display: 'flex',
                            gap: '20px',
                            alignItems: 'flex-start',
                            borderLeft: `4px solid ${log.action === 'booked' ? '#4caf50' :
                                log.action === 'cancelled' ? '#f44336' :
                                    log.action === 'rescheduled' ? '#2196f3' : '#000'
                                }`
                        }}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: getActionColor(log.action),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {getActionIcon(log.action)}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: '8px', fontSize: '1.05rem' }}>
                                <span style={{ fontWeight: 800 }}>{log.performedBy.name}</span>
                                <span className="text-muted"> ({log.performedBy.role}) </span>
                                <span style={{ fontWeight: 600 }}>{log.action}</span>
                                <span> a session for </span>
                                <span style={{ fontWeight: 800 }}>{log.sessionDetails.clientName}</span>
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '16px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                background: '#f9f9f9',
                                padding: '12px',
                                border: '1px solid #eee'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <User size={14} className="text-muted" />
                                    <span>{log.sessionDetails.trainerName}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} className="text-muted" />
                                    <span>{new Date(log.sessionDetails.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={14} className="text-muted" />
                                    <span>{log.sessionDetails.time}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', color: '#666' }}>
                                    <span>{log.sessionDetails.serviceName}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            fontSize: '0.8rem',
                            color: '#888',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                        }}>
                            {formatTimestamp(log.timestamp)}
                        </div>
                    </div>
                )) : (
                    <div style={{ padding: '60px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #ccc' }}>
                        <Clock size={48} style={{ margin: '0 auto 16px', color: '#ccc' }} />
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No activity yet</h3>
                        <p className="text-muted">Booking actions will appear here once they are performed.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
