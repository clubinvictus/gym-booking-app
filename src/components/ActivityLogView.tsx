import { useState, useMemo } from 'react';
import { Calendar, User, Clock, CheckCircle, XCircle, RefreshCw, Search, Filter, Trash2 } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';

export const ActivityLogView = () => {
    const { data: logs, loading } = useFirestore<any>('activity_logs');
    const { data: trainers } = useFirestore<any>('trainers');

    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [selectedTrainer, setSelectedTrainer] = useState<string>('All');
    const [clientSearch, setClientSearch] = useState<string>('');

    const filteredLogs = useMemo(() => {
        if (!logs) return [];
        return logs
            .filter((log: any) => {
                // Date filter
                if (selectedDate) {
                    const logDate = log.timestamp.split('T')[0];
                    if (logDate !== selectedDate) return false;
                }

                // Trainer filter
                if (selectedTrainer !== 'All') {
                    if (log.sessionDetails.trainerName !== selectedTrainer) return false;
                }

                // Client search filter
                if (clientSearch) {
                    const search = clientSearch.toLowerCase();
                    const clientName = log.sessionDetails.clientName.toLowerCase();
                    if (!clientName.includes(search)) return false;
                }

                return true;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [logs, selectedDate, selectedTrainer, clientSearch]);

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p className="text-muted">Loading activity logs...</p>
            </div>
        );
    }

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

    const handleQuickFilter = (type: 'today' | 'yesterday' | 'clear') => {
        if (type === 'today') {
            setSelectedDate(today);
        } else if (type === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            setSelectedDate(yesterday.toISOString().split('T')[0]);
        } else {
            setSelectedDate('');
            setSelectedTrainer('All');
            setClientSearch('');
        }
    };

    return (
        <div style={{ padding: window.innerWidth <= 768 ? '24px 16px' : '40px', maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: window.innerWidth <= 768 ? '2rem' : '2.5rem', marginBottom: '8px' }}>Activity Log</h1>
                <p className="text-muted">Track booking changes and studio activity</p>
            </header>

            {/* Filter Bar */}
            <div className="card" style={{ padding: '24px', marginBottom: '32px', border: '4px solid #000' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase' }}>Filter by Date</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} className="text-muted" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 36px',
                                    border: '2px solid #000',
                                    borderRadius: 0,
                                    fontSize: '0.9rem',
                                    fontWeight: 600
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase' }}>Filter by Trainer</label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} className="text-muted" />
                            <select
                                value={selectedTrainer}
                                onChange={(e) => setSelectedTrainer(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 36px',
                                    border: '2px solid #000',
                                    borderRadius: 0,
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    appearance: 'none',
                                    background: '#fff'
                                }}
                            >
                                <option value="All">All Trainers</option>
                                {trainers.map((t: any) => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ flex: '2 1 300px' }}>
                        <label style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase' }}>Search Client</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} className="text-muted" />
                            <input
                                type="text"
                                placeholder="Enter client name..."
                                value={clientSearch}
                                onChange={(e) => setClientSearch(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 36px',
                                    border: '2px solid #000',
                                    borderRadius: 0,
                                    fontSize: '0.9rem',
                                    fontWeight: 600
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleQuickFilter('today')} className="button-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Today</button>
                        <button onClick={() => handleQuickFilter('yesterday')} className="button-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Yesterday</button>
                    </div>
                    <button
                        onClick={() => handleQuickFilter('clear')}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        <Trash2 size={16} />
                        Clear All
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                    <div
                        key={log.id}
                        className="card"
                        style={{
                            padding: '20px',
                            display: 'flex',
                            flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                            gap: '20px',
                            alignItems: 'flex-start',
                            borderLeft: `6px solid ${log.action === 'booked' ? '#4caf50' :
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
                                flexWrap: 'wrap',
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: window.innerWidth <= 768 ? '0' : 'auto', color: '#666' }}>
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
                        <Filter size={48} style={{ margin: '0 auto 16px', color: '#ccc' }} />
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No matches found</h3>
                        <p className="text-muted">Adjust your filters to see more activity.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
