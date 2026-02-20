import { useState } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import { useAuth } from '../AuthContext';
import { Calendar, Clock, Briefcase } from 'lucide-react';
import { SessionDetailModal } from './SessionDetailModal';
import { BookingModal } from './BookingModal';

export const ClientDashboardView = () => {
    const { profile, user } = useAuth();
    const { data: sessions } = useFirestore<any>('sessions');
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [selectedSlot, setSelectedSlot] = useState<any>(null);

    // Filter to only the client's own sessions using UID (not name)
    const mySessions = sessions
        .filter(s => s.clientId === user?.uid || s.clientName === profile?.name)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter to only upcoming sessions
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const upcomingSessions = mySessions.filter(s => {
        return new Date(s.date) >= today;
    });

    const formatSessionDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div style={{ padding: '40px' }}>
            <header style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>My Dashboard</h1>
                <p className="text-muted">Welcome back, {profile?.name || 'Client'}! Here are your upcoming sessions.</p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {upcomingSessions.length > 0 ? upcomingSessions.map(session => (
                    <div
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className="card"
                        style={{
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '24px',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                            <div style={{ padding: '8px 16px', background: '#000', color: '#fff', fontWeight: 800, fontSize: '0.85rem', width: 'fit-content' }}>
                                {session.serviceName.toUpperCase()}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Calendar size={20} className="text-muted" />
                                <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>{formatSessionDate(session.date)}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', color: '#444', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={18} className="text-muted" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{session.time}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={18} className="text-muted" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{session.trainerName}</span>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #ccc' }}>
                        <p style={{ fontWeight: 700, color: '#666', fontSize: '1.1rem' }}>You have no upcoming sessions booked.</p>
                        <p className="text-muted" style={{ marginTop: '8px' }}>Go to the Calendar to book your next visit!</p>
                    </div>
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
