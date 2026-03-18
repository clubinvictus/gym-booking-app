import { useState } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import { useAuth } from '../AuthContext';
import { Calendar, Clock, Briefcase } from 'lucide-react';
import { SessionDetailModal } from './SessionDetailModal';
import { BookingModal } from './BookingModal';
import { where } from 'firebase/firestore';

export const ClientDashboardView = () => {
    const { profile, user } = useAuth();
    const clientIds = [user?.uid, profile?.clientId].filter(Boolean);
    const { data: sessions } = useFirestore<any>('sessions', clientIds.length > 0 ? [where('clientId', 'in', clientIds)] : []);
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [selectedSlot, setSelectedSlot] = useState<any>(null);
    const [visibleCount, setVisibleCount] = useState(10);

    // Filter to only the client's own sessions using UID
    const mySessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter to only upcoming sessions
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const upcomingSessions = mySessions.filter(s => {
        return new Date(s.date) >= today;
    });

    const displayedSessions = upcomingSessions.slice(0, visibleCount);

    const formatSessionDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div style={{ padding: '40px' }}>
            <header style={{
                marginBottom: '40px',
                display: 'flex',
                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                gap: '24px'
            }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>My Dashboard</h1>
                    <p className="text-muted">Welcome back, {profile?.name || 'Client'}! Here are your upcoming sessions.</p>
                </div>
                <button
                    onClick={() => {
                        const nextHour = new Date();
                        nextHour.setHours(nextHour.getHours() + 1);
                        nextHour.setMinutes(0);
                        
                        setSelectedSlot({
                            time: nextHour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                            day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                            trainerId: 'all'
                        });
                    }}
                    className="button-primary"
                    style={{
                        padding: '12px 24px',
                        fontSize: '1rem',
                        fontWeight: 800,
                        width: window.innerWidth <= 768 ? '100%' : 'auto',
                        whiteSpace: 'nowrap'
                    }}
                >
                    + NEW BOOKING
                </button>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {displayedSessions.length > 0 ? displayedSessions.map(session => (
                    <div
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className="card"
                        style={{
                            padding: window.innerWidth <= 768 ? '16px' : '24px',
                            display: 'flex',
                            flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                            alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                            justifyContent: 'space-between',
                            gap: window.innerWidth <= 768 ? '16px' : '24px',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            border: '3px solid #000',
                            flexWrap: 'wrap' // allows wrapping on very narrow screens
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '4px 4px 0px #000';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center', gap: window.innerWidth <= 768 ? '12px' : '24px', flexWrap: 'wrap', flexDirection: window.innerWidth <= 768 ? 'column-reverse' : 'row' }}>
                            <div style={{ padding: '6px 12px', background: '#000', color: '#fff', fontWeight: 800, fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.85rem', width: 'fit-content' }}>
                                {session.serviceName.toUpperCase()}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={window.innerWidth <= 768 ? 16 : 20} className="text-muted" />
                                <span style={{ fontWeight: 800, fontSize: window.innerWidth <= 768 ? '1rem' : '1.2rem' }}>{formatSessionDate(session.date)}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: window.innerWidth <= 768 ? 'column' : 'row', alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center', gap: window.innerWidth <= 768 ? '8px' : '32px', color: '#444', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={window.innerWidth <= 768 ? 16 : 18} className="text-muted" />
                                <span style={{ fontWeight: 700, fontSize: window.innerWidth <= 768 ? '0.95rem' : '1.1rem' }}>{session.time}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={window.innerWidth <= 768 ? 16 : 18} className="text-muted" />
                                <span style={{ fontWeight: 700, fontSize: window.innerWidth <= 768 ? '0.95rem' : '1.1rem' }}>{session.trainerName}</span>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #ccc' }}>
                        <p style={{ fontWeight: 700, color: '#666', fontSize: '1.1rem' }}>You have no upcoming sessions booked.</p>
                        <p className="text-muted" style={{ marginTop: '8px' }}>Go to the Calendar to book your next visit!</p>
                    </div>
                )}

                {visibleCount < upcomingSessions.length && (
                    <button
                        onClick={() => setVisibleCount(prev => prev + 10)}
                        className="button-secondary"
                        style={{ marginTop: '16px', width: '100%', padding: '16px', fontSize: '1rem', border: '3px solid #000' }}
                    >
                        LOAD MORE SESSIONS
                    </button>
                )}
            </div>

            <BookingModal
                isOpen={!!selectedSlot}
                onClose={() => {
                    setSelectedSlot(null);
                    setSelectedSession(null);
                }}
                selectedSlot={selectedSlot}
                editingSession={selectedSession}
                onBook={(data) => {
                    console.log('Session booked/updated:', data);
                    setSelectedSlot(null);
                    setSelectedSession(null);
                }}
            />

            <SessionDetailModal
                isOpen={!!selectedSession && !selectedSlot}
                onClose={() => setSelectedSession(null)}
                session={selectedSession}
                onDelete={(id) => {
                    console.log('Session deleted:', id);
                    setSelectedSession(null);
                }}
                onReschedule={(session) => {
                    setSelectedSlot({
                        day: session.day,
                        time: session.time,
                        trainerId: session.trainerId
                    });
                }}
            />
        </div>
    );
};
