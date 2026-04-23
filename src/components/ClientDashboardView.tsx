import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useSessions } from '../hooks/useSessions';
import { Clock, Briefcase } from 'lucide-react';
import { SessionDetailModal } from './SessionDetailModal';
import { BookingModal } from './BookingModal';

export const ClientDashboardView = () => {
    const { profile, user, loading: authLoading } = useAuth();

    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [selectedSlot, setSelectedSlot] = useState<any>(null);

    // Fetch from today forward — clients only need upcoming sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { sessions, loading: sessionsLoading } = useSessions({
        role: profile?.role as any,
        userId: user?.uid || '',
        clientId: profile?.clientId || undefined,
        startDate: today,
        includePast: false, // Only fetch future sessions from Firestore
        pageSize: 100
    });

    const isLoading = authLoading || sessionsLoading;

    // Parse "06:00 AM" / "05:00 PM" into a UTC-safe timestamp for sorting
    const sessionToMs = (s: any): number => {
        try {
            // Prefer native Firestore Timestamp
            if (s.startTime?.toDate) return s.startTime.toDate().getTime();
            if (s.startTime instanceof Date) return s.startTime.getTime();

            // Build from ISO date prefix + time string
            const datePart = String(s.date).substring(0, 10); // "2026-04-25"
            const [y, m, d] = datePart.split('-').map(Number);
            const normalized = (s.time || '').replace(/\u202F/g, ' ').trim();
            const [timePart, ampm] = normalized.split(' ');
            let [h, min] = timePart.split(':').map(Number);
            if (ampm?.toUpperCase() === 'PM' && h < 12) h += 12;
            if (ampm?.toUpperCase() === 'AM' && h === 12) h = 0;
            return new Date(y, m - 1, d, h, min).getTime();
        } catch { return Infinity; }
    };

    const now = Date.now();

    // Filter to strictly future sessions that belong to this client, sort chronologically, cap at 10
    const upcomingSessions = sessions
        .filter((s: any) => {
            const isMySession = s.clientId === profile?.clientId || 
                                s.clientIds?.includes(profile?.clientId) || 
                                s.client_ids?.includes(profile?.clientId) || 
                                s.uids?.includes(user?.uid) || 
                                (s.clients && s.clients.some((c: any) => c.id === profile?.clientId));
            return isMySession && sessionToMs(s) >= now;
        })
        .sort((a: any, b: any) => sessionToMs(a) - sessionToMs(b))
        .slice(0, 10);

    // Format date for session cards: "Apr 25 @ 06:00 PM"
    const formatDateAndTime = (session: any): string => {
        const ms = sessionToMs(session);
        if (!isFinite(ms)) return session.time || '';
        const d = new Date(ms);
        const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${datePart} @ ${session.time}`;
    };

    if (isLoading) {
        return (
            <div style={{
                padding: '100px 40px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #000',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
                <p style={{ fontWeight: 800, color: '#000', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>LOADING YOUR SCHEDULE...</p>
            </div>
        );
    }

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
                        nextHour.setSeconds(0);
                        nextHour.setMilliseconds(0);

                        const dayName = nextHour.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                        const daysMap = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        const dayIndex = daysMap.indexOf(dayName);

                        const timeStr = nextHour.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        }).replace(/\u202F/g, ' ');

                        setSelectedSlot({
                            time: timeStr,
                            day: dayIndex !== -1 ? dayIndex : 0,
                            date: nextHour,
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

            <div className="card" style={{ padding: window.innerWidth <= 768 ? '20px' : '32px', marginBottom: '32px', border: '3px solid #000' }}>
                {/* Section header */}
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 24px 0' }}>
                    UPCOMING SESSIONS
                </h2>

                {/* Session list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {upcomingSessions.length > 0 ? upcomingSessions.map((session: any) => (
                        <div
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            style={{
                                padding: window.innerWidth <= 768 ? '16px' : '24px',
                                display: 'flex',
                                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                                alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                                justifyContent: 'space-between',
                                gap: window.innerWidth <= 768 ? '16px' : '24px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                border: '2px solid #eee',
                                borderRadius: '4px',
                                flexWrap: 'wrap'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#000';
                                e.currentTarget.style.background = '#f9f9f9';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#eee';
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            {/* Left: service tag + date/time */}
                            <div style={{ display: 'flex', alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center', gap: window.innerWidth <= 768 ? '12px' : '24px', flexWrap: 'wrap', flexDirection: window.innerWidth <= 768 ? 'column-reverse' : 'row' }}>
                                <div style={{ padding: '6px 12px', background: '#000', color: '#fff', fontWeight: 800, fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.85rem', width: 'fit-content' }}>
                                    {session.serviceName?.toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={window.innerWidth <= 768 ? 16 : 20} className="text-muted" />
                                    <span style={{ fontWeight: 800, fontSize: window.innerWidth <= 768 ? '1rem' : '1.1rem' }}>
                                        {formatDateAndTime(session)}
                                    </span>
                                </div>
                            </div>

                            {/* Right: trainer */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#444' }}>
                                <Briefcase size={window.innerWidth <= 768 ? 16 : 18} className="text-muted" />
                                <span style={{ fontWeight: 700, fontSize: window.innerWidth <= 768 ? '0.95rem' : '1.1rem' }}>
                                    {session.trainerName}
                                </span>
                            </div>
                        </div>
                    )) : (
                        <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #000' }}>
                            <p style={{ fontWeight: 800, color: '#000', fontSize: '1rem', textTransform: 'uppercase' }}>
                                No upcoming sessions. Book one now!
                            </p>
                        </div>
                    )}
                </div>
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
                        trainerId: session.trainerId,
                        date: session.date ? new Date(session.date) : new Date()
                    });
                }}
            />
        </div>
    );
};
