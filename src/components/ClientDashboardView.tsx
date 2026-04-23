import { useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { useSessions } from '../hooks/useSessions';
import { Calendar, Clock, Briefcase, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { SessionDetailModal } from './SessionDetailModal';
import { BookingModal } from './BookingModal';

export const ClientDashboardView = () => {
    const { profile, user, loading: authLoading } = useAuth();
    
    // Use clientId (from profile or client record) to query sessions.
    // This is more reliable than uid because admins booking for clients
    // always populate 'client_ids' even when 'uids' may be empty.
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [selectedSlot, setSelectedSlot] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const dateInputRef = useRef<HTMLInputElement>(null);
    
    // Fetch sessions for the selected month
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    
    const { sessions, loading: sessionsLoading, hasMore, loadMore } = useSessions({
        role: profile?.role as any,
        userId: user?.uid || '',
        clientId: profile?.clientId || undefined,
        startDate: monthStart,
        pageSize: 100
    });

    const isLoading = authLoading || sessionsLoading;

    // Filtering Logic
    const now = new Date();
    const isSelectedToday = selectedDate.toDateString() === now.toDateString();
    const selectedDateStr = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const displayedSessions = sessions.filter((s: any) => {
        if (!s) return false;
        
        const now = new Date();
        const isToday = selectedDate.toDateString() === now.toDateString();
        
        try {
            let sessionStart: Date;
            if (s.startTime?.toDate) {
                sessionStart = s.startTime.toDate();
            } else if (s.startTime instanceof Date) {
                sessionStart = s.startTime;
            } else if (s.date && s.time) {
                const [y, m, d] = s.date.split('-').map(Number);
                const timeStr = s.time.replace(/\u202F/g, ' ');
                const [timePart, ampm] = timeStr.split(' ');
                let [hours, minutes] = timePart.split(':').map(Number);
                if (ampm?.toUpperCase() === 'PM' && hours < 12) hours += 12;
                if (ampm?.toUpperCase() === 'AM' && hours === 12) hours = 0;
                sessionStart = new Date(y, m - 1, d, hours, minutes);
            } else {
                sessionStart = new Date(s.date || now);
            }

            if (isNaN(sessionStart.getTime())) return true;

            const isSameDay = sessionStart.toDateString() === selectedDate.toDateString();
            if (!isSameDay) return false;

            if (isToday) {
                return sessionStart.getTime() >= now.getTime();
            }
            return true;
        } catch (err) {
            return true; // Failsafe
        }
    }).sort((a: any, b: any) => {
        const parseTime = (s: any) => {
            if (s.startTime?.toDate) return s.startTime.toDate().getTime();
            if (s.startTime instanceof Date) return s.startTime.getTime();
            return new Date(`${s.date} ${s.time}`).getTime();
        };
        return parseTime(a) - parseTime(b);
    });

    const formatSessionDate = (session: any) => {
        const d = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.date);
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
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
                        // Calculate the next clean hour for a suggested slot
                        const nextHour = new Date();
                        nextHour.setHours(nextHour.getHours() + 1);
                        nextHour.setMinutes(0);
                        nextHour.setSeconds(0);
                        nextHour.setMilliseconds(0);
                        
                        // Map the Date object to our 0-6 (Mon-Sun) day index
                        const dayName = nextHour.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                        const daysMap = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        const dayIndex = daysMap.indexOf(dayName);
                        
                        // Force clean "09:00 AM" format for the modal (fix narrow non-breaking spaces on iOS/Safari)
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
                <div style={{ 
                    display: 'flex', 
                    flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                    justifyContent: 'space-between', 
                    alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center', 
                    marginBottom: '24px',
                    gap: '16px'
                }}>
                    <div style={{ position: 'relative' }}>
                        <button 
                            onClick={() => dateInputRef.current?.showPicker()}
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                padding: '8px 12px', 
                                margin: '-8px -12px',
                                borderRadius: '4px',
                                textAlign: 'left', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '12px',
                                transition: 'background 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Calendar size={20} />
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>
                                {isSelectedToday ? `TODAY: ${selectedDateStr}` : selectedDateStr}
                            </h2>
                            <ChevronDown size={18} className="text-muted" />
                        </button>
                        <input 
                            ref={dateInputRef}
                            type="date"
                            value={selectedDate.toISOString().split('T')[0]}
                            onChange={(e) => {
                                if (e.target.value) {
                                    const [y, m, d] = e.target.value.split('-').map(Number);
                                    setSelectedDate(new Date(y, m - 1, d));
                                }
                            }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                opacity: 0,
                                pointerEvents: 'none'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', width: window.innerWidth <= 768 ? '100%' : 'auto' }}>
                        <button 
                            onClick={() => {
                                const prev = new Date(selectedDate);
                                prev.setDate(prev.getDate() - 1);
                                setSelectedDate(prev);
                            }}
                            style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button 
                            onClick={() => setSelectedDate(new Date())}
                            style={{ flex: 2, background: '#000', color: '#fff', border: 'none', padding: '12px 16px', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase' }}
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => {
                                const next = new Date(selectedDate);
                                next.setDate(next.getDate() + 1);
                                setSelectedDate(next);
                            }}
                            style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {displayedSessions.length > 0 ? displayedSessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className="session-card" // Added a class for internal styling if needed
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
                            <div style={{ display: 'flex', alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center', gap: window.innerWidth <= 768 ? '12px' : '24px', flexWrap: 'wrap', flexDirection: window.innerWidth <= 768 ? 'column-reverse' : 'row' }}>
                                <div style={{ padding: '6px 12px', background: '#000', color: '#fff', fontWeight: 800, fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.85rem', width: 'fit-content' }}>
                                    {session.serviceName.toUpperCase()}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={window.innerWidth <= 768 ? 16 : 20} className="text-muted" />
                                    <span style={{ fontWeight: 800, fontSize: window.innerWidth <= 768 ? '1rem' : '1.2rem' }}>{session.time}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: window.innerWidth <= 768 ? 'column' : 'row', alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center', gap: window.innerWidth <= 768 ? '8px' : '32px', color: '#444', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={window.innerWidth <= 768 ? 16 : 18} className="text-muted" />
                                    <span style={{ fontWeight: 700, fontSize: window.innerWidth <= 768 ? '0.95rem' : '1.1rem' }}>{formatSessionDate(session)}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Briefcase size={window.innerWidth <= 768 ? 16 : 18} className="text-muted" />
                                    <span style={{ fontWeight: 700, fontSize: window.innerWidth <= 768 ? '0.95rem' : '1.1rem' }}>{session.trainerName}</span>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #000' }}>
                            <p style={{ fontWeight: 800, color: '#000', fontSize: '1rem', textTransform: 'uppercase' }}>
                                {isSelectedToday ? 'No more sessions for today. Enjoy your day!' : 'No sessions scheduled for this date.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

                {hasMore && (
                    <button
                        onClick={loadMore}
                        disabled={sessionsLoading}
                        className="button-secondary"
                        style={{ 
                            marginTop: '16px', 
                            width: '100%', 
                            padding: '16px', 
                            fontSize: '1rem', 
                            border: '3px solid #000',
                            opacity: sessionsLoading ? 0.5 : 1,
                            cursor: sessionsLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {sessionsLoading ? 'LOADING MORE...' : 'LOAD MORE SESSIONS'}
                    </button>
                )}

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
                    // Pass the session date so getTargetDate doesn't default to today,
                    // which would block the reschedule with a false "past booking" error.
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
