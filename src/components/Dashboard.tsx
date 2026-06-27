import { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, Users, Briefcase, Settings, LogOut, Menu, X, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CalendarView } from './CalendarView';
import { ServiceManagement } from './ServiceManagement';
import { ClientManagement } from './ClientManagement';
import { SettingsView } from './SettingsView';
import { useFirestore } from '../hooks/useFirestore';

// New Components
import { collection, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ActivityLogView } from './ActivityLogView';
import { SITE_ID } from '../constants';
import { TrainerProfile } from './TrainerProfile';
import { ClientProfile } from './ClientProfile';
import { useSessions } from '../hooks/useSessions';
import { SessionDetailModal } from './SessionDetailModal';
import { TeamManagement } from './TeamManagement';
import { AddTrainerModal } from './AddTrainerModal';
import { AddManagerModal } from './AddManagerModal';
import { AddClientModal } from './AddClientModal';
import { AddServiceModal } from './AddServiceModal';
import { EditTrainerModal } from './EditTrainerModal';
import { signOut } from 'firebase/auth';
import { useAuth } from '../AuthContext';
import { useConfirm } from '../ConfirmContext';
import { TermsModal } from './TermsModal';
import { ConfirmModal } from './ConfirmModal';
import { BookingModal } from './BookingModal';

interface DashboardProps {
    view?: 'dashboard' | 'calendar' | 'team' | 'services' | 'clients' | 'activity' | 'settings';
}

export const Dashboard = ({ view = 'dashboard' }: DashboardProps) => {
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [trainerModalOpen, setTrainerModalOpen] = useState(false);
    const [managerModalOpen, setManagerModalOpen] = useState(false);
    const [clientModalOpen, setClientModalOpen] = useState(false);
    const [editTrainerOpen, setEditTrainerOpen] = useState(false);
    const [serviceModalOpen, setServiceModalOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [settingsTab, setSettingsTab] = useState('general');
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [bookingSlot, setBookingSlot] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [clientStartDate, setClientStartDate] = useState(new Date());
    const [clientEndDate, setClientEndDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
    });
    const [clientVisibleCount, setClientVisibleCount] = useState(10);
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();

    // Check if client needs to accept terms
    const showTerms = profile?.role === 'client' && !profile?.termsAccepted;
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isAdmin = profile?.role === 'admin';
    const isManager = profile?.role === 'manager';
    const isTrainer = profile?.role === 'trainer';
    const isClient = profile?.role === 'client';

    // Use Firestore for stats
    const { data: trainers } = useFirestore<any>('trainers');
    const { data: clients } = useFirestore<any>('clients', [], !isAdmin && !isManager);
    
    // Fetch sessions for the selected month — always provide both startDate and endDate
    // so SessionService uses the date range path (not the endTime > now path).
    const monthStart = isClient ? new Date(clientStartDate) : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = isClient ? new Date(clientEndDate) : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    
    // For trainers: resolve their trainerId. The AuthContext may sync this async,
    // so we also check profile.id as a fallback (the Firestore users doc ID equals
    // the trainers doc ID for trainer accounts created correctly).
    const resolvedTrainerId = isTrainer
        ? (profile?.trainerId || undefined)
        : undefined;

    // Using the centralized useSessions hook for standardized fetching
    const { sessions } = useSessions({
        role: profile?.role as any || 'admin',
        userId: user?.uid || '',
        clientId: isClient ? (profile?.clientId || undefined) : undefined,
        trainerId: resolvedTrainerId,
        startDate: monthStart,
        endDate:   monthEnd,
        includePast: true,
        pageSize: 2000,
        fetchMode: isClient ? 'my-bookings' : 'all'
    });


    const handleClientClick = (client: any) => {
        setSelectedClient(client);
    };

    const handleTrainerEdit = () => {
        setEditTrainerOpen(true);
    };

    const handleTrainerDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'trainers', id));
            setSelectedTrainerId(null);
            alert('Trainer deleted successfully.');
        } catch (error) {
            console.error('Error deleting trainer:', error);
            alert('Failed to delete trainer.');
        }
    };

    const renderContent = () => {
        const selectedTrainer = trainers.find(t => t.id === selectedTrainerId);

        // Check for profile views first
        if (view === 'team' && selectedTrainer) {
            return (
                <TrainerProfile
                    trainer={selectedTrainer}
                    onBack={() => setSelectedTrainerId(null)}
                    onEdit={handleTrainerEdit}
                    onDelete={handleTrainerDelete}
                />
            );
        }
        if (view === 'clients' && selectedClient) {
            return <ClientProfile client={selectedClient} onBack={() => setSelectedClient(null)} />;
        }

        switch (view) {
            case 'calendar':
                return <CalendarView />;
            case 'team':
                return (
                    <TeamManagement
                        onTrainerClick={(trainer) => setSelectedTrainerId(trainer.id)}
                        onAddTrainerClick={() => setTrainerModalOpen(true)}
                        onAddManagerClick={() => setManagerModalOpen(true)}
                        onDeleteManagerClick={async (id) => {
                            const confirmed = await confirm({
                                title: 'Remove Manager',
                                message: 'Are you sure you want to remove this manager? This action cannot be undone.',
                                confirmLabel: 'Remove Manager',
                                type: 'danger'
                            });

                            if (confirmed) {
                                try {
                                    await deleteDoc(doc(db, 'managers', id));
                                } catch (error) {
                                    console.error('Error removing manager:', error);
                                }
                            }
                        }}
                    />
                );
            case 'services':
                return (
                    <ServiceManagement
                        onAddClick={() => {
                            setSelectedService(null);
                            setServiceModalOpen(true);
                        }}
                        onEditClick={(service) => {
                            setSelectedService(service);
                            setServiceModalOpen(true);
                        }}
                    />
                );
            case 'clients':
                return <ClientManagement onClientClick={handleClientClick} onAddClick={() => setClientModalOpen(true)} />;
            case 'activity':
                return <ActivityLogView />;
            case 'settings':
                return (
                    <SettingsView
                        activeTab={settingsTab}
                        onTabChange={setSettingsTab}
                        onAddService={() => {
                            setSelectedService(null);
                            setServiceModalOpen(true);
                        }}
                        onEditService={(service) => {
                            setSelectedService(service);
                            setServiceModalOpen(true);
                        }}
                    />
                );
            default:

                const now = new Date();
                const isSelectedToday = selectedDate.toDateString() === now.toDateString();

                // Sessions are already filtered by role and siteId from the server,
                // but clients receive ALL Limitless Open sessions globally so they can join them in CalendarView.
                // For the Dashboard, we strictly filter to ONLY sessions they are booked into.
                const userSessions = (sessions || []).filter((s: any) => {
                    if (!isClient) return true;
                    const hasProfileClientId = !!profile?.clientId;
                    const hasUserUid = !!user?.uid;
                    return (
                        (hasProfileClientId && s.clientId === profile?.clientId) || 
                        (hasProfileClientId && s.clientIds?.includes(profile?.clientId)) || 
                        (hasProfileClientId && s.client_ids?.includes(profile?.clientId)) || 
                        (hasUserUid && s.uids?.includes(user?.uid)) || 
                        (hasProfileClientId && s.attendees && s.attendees.includes(profile?.clientId)) ||
                        (hasProfileClientId && s.clients && s.clients.some((c: any) => c.id === profile?.clientId))
                    );
                });

                // Parse a time string like "06:00 AM" or "05:00 PM" into minutes since midnight
                // so that AM/PM sessions sort correctly (not lexicographically).
                const timeToMinutes = (timeStr: string): number => {
                    if (!timeStr) return 9999;
                    try {
                        const normalized = timeStr.replace(/\u202F/g, ' ').trim();
                        const [timePart, ampm] = normalized.split(' ');
                        let [h, m] = timePart.split(':').map(Number);
                        if (ampm?.toUpperCase() === 'PM' && h < 12) h += 12;
                        if (ampm?.toUpperCase() === 'AM' && h === 12) h = 0;
                        return h * 60 + m;
                    } catch { return 9999; }
                };

                // Sessions store date as a full ISO string or native Timestamp.
                // We resolve to a local Date object to avoid UTC timezone drift.
                const sessionsForDay = userSessions
                    .filter((s: any) => {
                        if (isClient) return true; // Clients show all sessions in the selected date range

                        // Support both Firestore Timestamp-based startTime and ISO date string
                        const selectedDateISO = new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
                        let sessionDateISO: string | null = null;
                        if (s.startTime?.toDate) {
                            sessionDateISO = s.startTime.toDate().toISOString().substring(0, 10);
                        } else if (s.startTime instanceof Date) {
                            sessionDateISO = s.startTime.toISOString().substring(0, 10);
                        } else if (s.date) {
                            sessionDateISO = String(s.date).substring(0, 10);
                        }
                        return sessionDateISO === selectedDateISO;
                    })
                    .sort((a: any, b: any) => {
                        if (isClient) {
                            let dateA = a.date;
                            let dateB = b.date;
                            if (a.startTime?.toDate) dateA = a.startTime.toDate().toISOString().substring(0, 10);
                            else if (a.startTime instanceof Date) dateA = a.startTime.toISOString().substring(0, 10);
                            
                            if (b.startTime?.toDate) dateB = b.startTime.toDate().toISOString().substring(0, 10);
                            else if (b.startTime instanceof Date) dateB = b.startTime.toISOString().substring(0, 10);

                            const dateCompare = String(dateA).localeCompare(String(dateB));
                            if (dateCompare !== 0) return dateCompare;
                        }
                        return timeToMinutes(a.time) - timeToMinutes(b.time);
                    });

                // For today: hide sessions that have already started/passed.
                // For any other date: show all sessions in chronological order.
                const filteredSessions = isSelectedToday && !isClient
                    ? sessionsForDay.filter((s: any) => timeToMinutes(s.time) >= (now.getHours() * 60 + now.getMinutes()))
                    : sessionsForDay;

                // Stats calculation (keeping these relative to 'Today' for the macro view)
                const todaySessionsCount = userSessions.filter((s: any) => {
                    const d = s.date ? new Date(s.date) : (s.startTime?.toDate ? s.startTime.toDate() : null);
                    return d?.toDateString() === now.toDateString();
                }).length;

                // Week boundaries for stats
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
                startOfWeek.setHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);

                const sessionsThisWeek = userSessions.filter((s: any) => {
                    const d = s.date ? new Date(s.date) : (s.startTime?.toDate ? s.startTime.toDate() : null);
                    return d && d >= startOfWeek && d <= endOfWeek;
                });

                const sessionsThisMonth = userSessions.filter((s: any) => {
                    const d = s.date ? new Date(s.date) : (s.startTime?.toDate ? s.startTime.toDate() : null);
                    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                });

                return (
                    <div style={{ width: '100%' }}>
                        <header style={{
                            marginBottom: '40px',
                            display: 'flex',
                            flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                            justifyContent: 'space-between',
                            alignItems: window.innerWidth <= 768 ? 'stretch' : 'flex-start',
                            gap: '24px'
                        }}>
                            <div>
                                <h1 style={{ 
                                    fontSize: window.innerWidth <= 768 ? '2rem' : '2.5rem', 
                                    marginBottom: '8px',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '-0.02em'
                                }}>DASHBOARD</h1>
                                <p className="text-muted" style={{ fontWeight: 500 }}>WELCOME BACK, {(profile?.name || 'User').toUpperCase()}! HERE'S YOUR SCHEDULE.</p>
                            </div>
                            {isClient && (
                                <button
                                    onClick={() => {
                                        const targetDate = new Date();
                                        targetDate.setHours(targetDate.getHours() + 1, 0, 0, 0); // next hour
                                        const jsDay = targetDate.getDay();
                                        const customDay = jsDay === 0 ? 6 : jsDay - 1;
                                        const timeString = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s*(AM|PM)\s*/i, ' $1').trim().toUpperCase();

                                        setBookingSlot({
                                            day: customDay,
                                            time: timeString,
                                            trainerId: null,
                                            date: targetDate
                                        });
                                    }}
                                    className="button-primary"
                                    style={{
                                        alignSelf: window.innerWidth <= 768 ? 'stretch' : 'flex-start',
                                        padding: '12px 24px',
                                        fontWeight: 800,
                                        fontSize: '0.9rem',
                                        letterSpacing: '0.05em'
                                    }}
                                >
                                    + BOOK SESSION
                                </button>
                            )}
                        </header>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(3, 1fr)',
                            gap: '24px',
                            marginBottom: '40px'
                        }}>
                            <StatCard title="TODAY'S SESSIONS" value={todaySessionsCount.toString()} icon={<Calendar size={24} />} />
                            
                            {(isTrainer || isClient) && (
                                <>
                                    <StatCard title="SESSIONS THIS WEEK" value={sessionsThisWeek.length.toString()} icon={<Briefcase size={24} />} />
                                    <StatCard title="SESSIONS THIS MONTH" value={sessionsThisMonth.length.toString()} icon={<Briefcase size={24} />} />
                                </>
                            )}

                            {isAdmin && (
                                <>
                                    <StatCard title="ACTIVE TRAINERS" value={trainers.filter((t: any) => t.status === 'Active').length.toString()} icon={<Users size={24} />} />
                                    <StatCard title="TOTAL CLIENTS" value={clients.length.toString()} icon={<Users size={24} />} />
                                </>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                            <div className="card" style={{ padding: '32px' }}>
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                                    justifyContent: 'space-between', 
                                    alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center', 
                                    marginBottom: '32px',
                                    gap: '16px'
                                }}>
                                    {isClient ? (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>START DATE</label>
                                                <input
                                                    type="date"
                                                    value={new Date(clientStartDate.getTime() - clientStartDate.getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                                                    onChange={(e) => {
                                                        setClientStartDate(new Date(e.target.value));
                                                        setClientVisibleCount(10);
                                                    }}
                                                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f3f4f6', color: 'black' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>END DATE</label>
                                                <input
                                                    type="date"
                                                    value={new Date(clientEndDate.getTime() - clientEndDate.getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                                                    onChange={(e) => {
                                                        setClientEndDate(new Date(e.target.value));
                                                        setClientVisibleCount(10);
                                                    }}
                                                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f3f4f6', color: 'black' }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="date"
                                                value={selectedDate ? new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000).toISOString().split('T')[0] : ''}
                                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f3f4f6', color: 'black' }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={() => {
                                                        const prev = new Date(selectedDate);
                                                        prev.setDate(prev.getDate() - 1);
                                                        setSelectedDate(prev);
                                                    }}
                                                    style={{ background: '#000', color: '#fff', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <ChevronLeft size={20} />
                                                </button>
                                                <button 
                                                    onClick={() => setSelectedDate(new Date())}
                                                    style={{ background: '#000', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase' }}
                                                >
                                                    Today
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const next = new Date(selectedDate);
                                                        next.setDate(next.getDate() + 1);
                                                        setSelectedDate(next);
                                                    }}
                                                    style={{ background: '#000', color: '#fff', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <ChevronRight size={20} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {filteredSessions.length > 0 ? (
                                        <>
                                            {(isClient ? filteredSessions.slice(0, clientVisibleCount) : filteredSessions).map((session: any) => {
                                                const displayTitle = isClient 
                                                    ? session.serviceName 
                                                    : (session.clients && Array.isArray(session.clients) ? session.clients.map((c: any) => c.name).join(', ') : (session.clientName || 'Unknown Client'));
                                                const displayType = isClient 
                                                    ? (session.clients?.length > 1 ? 'Group Session' : 'Session')
                                                    : session.serviceName;

                                                let displayDate = '';
                                                if (session.startTime?.toDate) {
                                                    displayDate = session.startTime.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                                } else if (session.startTime instanceof Date) {
                                                    displayDate = session.startTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                                } else if (session.date) {
                                                    displayDate = new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                                }

                                                return (
                                                    <SessionItem
                                                        key={session.id}
                                                        clientName={displayTitle}
                                                        trainerName={session.trainerName}
                                                        type={displayType}
                                                        time={session.time}
                                                        date={displayDate}
                                                        onClick={() => setSelectedSession(session)}
                                                    />
                                                );
                                            })}
                                            {isClient && filteredSessions.length > clientVisibleCount && (
                                                <button 
                                                    onClick={() => setClientVisibleCount(prev => prev + 10)}
                                                    className="button-secondary"
                                                    style={{ marginTop: '16px', padding: '12px', fontWeight: 800, textTransform: 'uppercase', width: '100%', border: '2px solid #000' }}
                                                >
                                                    LOAD MORE
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #000' }}>
                                            <p style={{ fontWeight: 800, color: '#000', fontSize: '1rem', textTransform: 'uppercase' }}>
                                                {isClient ? 'No sessions scheduled in this date range.' : (isSelectedToday ? 'No more sessions for today. Enjoy your day!' : 'No sessions scheduled for this date.')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="app-container">
            {/* Mobile Header */}
            <header className="mobile-header">
                <button
                    onClick={() => setSidebarOpen(true)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
                >
                    <Menu size={24} />
                </button>
                <img src="/logo white.png" alt="Invictus" style={{ height: '32px' }} />
            </header>

            {/* Sidebar Overlay (Mobile Only) */}
            <div
                className={`sidebar-overlay ${isSidebarOpen && window.innerWidth <= 768 ? 'visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`} style={{
                width: isSidebarOpen ? '280px' : '80px',
                backgroundColor: '#000',
                color: '#fff',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                padding: '24px 16px',
                position: 'relative',
                flexShrink: 0,
                height: '100dvh',      /* Fixed sidebar height */
                overflowY: 'auto',    /* Scroll if menu grows */
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', padding: '0 8px' }}>
                    <img src="/logo white.png" alt="Invictus" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                    {isSidebarOpen && <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.05em' }}>INVICTUS</span>}
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div onClick={() => {
                        window.innerWidth <= 768 && setSidebarOpen(false);
                        navigate('/dashboard');
                        setSelectedTrainerId(null);
                        setSelectedClient(null);
                    }}>
                        <NavItem icon={<LayoutDashboard size={20} />} label="DASHBOARD" active={view === 'dashboard'} isOpen={isSidebarOpen} />
                    </div>
                    <div onClick={() => {
                        window.innerWidth <= 768 && setSidebarOpen(false);
                        navigate('/calendar');
                        setSelectedTrainerId(null);
                        setSelectedClient(null);
                    }}>
                        <NavItem icon={<Calendar size={20} />} label="CALENDAR" active={view === 'calendar'} isOpen={isSidebarOpen} />
                    </div>
                    {(isAdmin || isManager) && (
                        <>
                            <div onClick={() => {
                                window.innerWidth <= 768 && setSidebarOpen(false);
                                navigate('/team');
                                setSelectedTrainerId(null);
                                setSelectedClient(null);
                            }}>
                                <NavItem icon={<Users size={20} />} label="TEAM" active={view === 'team'} isOpen={isSidebarOpen} />
                            </div>
                            <div onClick={() => {
                                window.innerWidth <= 768 && setSidebarOpen(false);
                                navigate('/services');
                                setSelectedTrainerId(null);
                                setSelectedClient(null);
                            }}>
                                <NavItem icon={<Briefcase size={20} />} label="SERVICES" active={view === 'services'} isOpen={isSidebarOpen} />
                            </div>
                            <div onClick={() => {
                                window.innerWidth <= 768 && setSidebarOpen(false);
                                navigate('/clients');
                                setSelectedTrainerId(null);
                                setSelectedClient(null);
                            }}>
                                <NavItem icon={<Users size={20} />} label="CLIENTS" active={view === 'clients'} isOpen={isSidebarOpen} />
                            </div>
                            <div onClick={() => {
                                window.innerWidth <= 768 && setSidebarOpen(false);
                                navigate('/activity');
                                setSelectedTrainerId(null);
                                setSelectedClient(null);
                            }}>
                                <NavItem icon={<Clock size={20} />} label="ACTIVITY LOG" active={view === 'activity'} isOpen={isSidebarOpen} />
                            </div>
                        </>
                    )}
                </nav>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {!isTrainer && (
                        <div onClick={() => {
                            window.innerWidth <= 768 && setSidebarOpen(false);
                            navigate('/settings');
                            setSelectedTrainerId(null);
                            setSelectedClient(null);
                        }}>
                            <NavItem icon={<Settings size={20} />} label="SETTINGS" active={view === 'settings'} isOpen={isSidebarOpen} />
                        </div>
                    )}
                    <button
                        onClick={() => setIsLogoutModalOpen(true)}
                        style={{ background: 'transparent', border: 'none', padding: 0, width: '100%', textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
                    >
                        <NavItem icon={<LogOut size={20} />} label="LOGOUT" isOpen={isSidebarOpen} />
                    </button>
                </div>

                <button
                    onClick={() => setSidebarOpen(!isSidebarOpen)}
                    style={{
                        position: 'absolute',
                        right: '-12px',
                        top: '32px',
                        background: '#000',
                        border: '2px solid #fff',
                        color: '#fff',
                        borderRadius: 0,
                        width: '24px',
                        height: '24px',
                        display: window.innerWidth <= 768 ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 10
                    }}
                >
                    {isSidebarOpen ? <X size={14} /> : <Menu size={14} />}
                </button>
            </aside>

            <main className="main-content">
                {renderContent()}
            </main>

            <AddTrainerModal
                isOpen={trainerModalOpen}
                onClose={() => setTrainerModalOpen(false)}
                onAdd={async (data) => {
                    const defaultAvailability = {
                        monday: { active: true, shifts: [{ start: '09:00', end: '17:00' }] },
                        tuesday: { active: true, shifts: [{ start: '09:00', end: '17:00' }] },
                        wednesday: { active: true, shifts: [{ start: '09:00', end: '17:00' }] },
                        thursday: { active: true, shifts: [{ start: '09:00', end: '17:00' }] },
                        friday: { active: true, shifts: [{ start: '09:00', end: '17:00' }] },
                        saturday: { active: false, shifts: [{ start: '10:00', end: '14:00' }] },
                        sunday: { active: false, shifts: [{ start: '10:00', end: '14:00' }] },
                    };

                    try {
                        await addDoc(collection(db, 'trainers'), {
                            ...data,
                            availability: defaultAvailability,
                            siteId: SITE_ID,
                            status: 'Active',
                            sessions: 0,
                            createdAt: new Date().toISOString()
                        });
                        setTrainerModalOpen(false);
                        alert('Trainer added successfully! (Note: Email invitation system is not yet connected)');
                    } catch (error) {
                        console.error('Error adding trainer:', error);
                        alert('Failed to add trainer.');
                    }
                }}
            />

            <AddManagerModal
                isOpen={managerModalOpen}
                onClose={() => setManagerModalOpen(false)}
                onAdd={async (data) => {
                    await addDoc(collection(db, 'managers'), {
                        ...data,
                        status: 'Active',
                        siteId: SITE_ID,
                        createdAt: new Date().toISOString()
                    });
                    setManagerModalOpen(false);
                    alert('Manager added successfully!');
                }}
            />

            {editTrainerOpen && (
                <EditTrainerModal
                    isOpen={editTrainerOpen}
                    onClose={() => setEditTrainerOpen(false)}
                    trainer={trainers.find(t => t.id === selectedTrainerId)}
                />
            )}
            <AddServiceModal
                isOpen={serviceModalOpen}
                onClose={() => {
                    setServiceModalOpen(false);
                    setSelectedService(null);
                }}
                editingService={selectedService}
                onAdd={() => {
                    setServiceModalOpen(false);
                    setSelectedService(null);
                }}
            />
            <AddClientModal
                isOpen={clientModalOpen}
                onClose={() => setClientModalOpen(false)}
                onAdd={async (data) => {
                    try {
                        await addDoc(collection(db, 'clients'), {
                            ...data,
                            siteId: SITE_ID,
                            status: 'Active',
                            createdAt: new Date().toISOString()
                        });
                        setClientModalOpen(false);
                        alert('Client added successfully!');
                    } catch (error) {
                        console.error('Error adding client:', error);
                        alert('Failed to add client.');
                    }
                }}
            />

            {selectedSession && (
                <SessionDetailModal
                    isOpen={!!selectedSession}
                    session={selectedSession}
                    onClose={() => setSelectedSession(null)}
                    onDelete={() => setSelectedSession(null)}
                    onReschedule={() => {
                        navigate('/calendar', { state: { rescheduleSession: selectedSession } });
                        setSelectedSession(null);
                    }}
                />
            )}

            <BookingModal
                isOpen={!!bookingSlot}
                onClose={() => setBookingSlot(null)}
                selectedSlot={bookingSlot}
                onBook={(data: any) => {
                    console.log('Session booked from dashboard:', data);
                    setBookingSlot(null);
                }}
            />

            <TermsModal 
                isOpen={showTerms} 
                onAccepted={() => {
                    console.log('Terms accepted');
                }} 
            />

            <ConfirmModal
                isOpen={isLogoutModalOpen}
                title="Confirm Logout"
                message="Are you sure you want to log out of your account?"
                confirmLabel="Log Out"
                type="danger"
                onConfirm={async () => {
                    await signOut(auth);
                    navigate('/login');
                }}
                onCancel={() => setIsLogoutModalOpen(false)}
            />
        </div>
    );
};

function NavItem({ icon, label, active, isOpen }: { icon: any, label: string, active?: boolean, isOpen: boolean }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            borderRadius: 0,
            background: active ? '#fff' : 'transparent',
            color: active ? '#000' : '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontWeight: active ? 700 : 400
        }}>
            {icon}
            {isOpen && <span>{label}</span>}
        </div>
    );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: any }) {
    return (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '12px', fontWeight: 600 }}>{title}</p>
                <h3 style={{ fontSize: '2rem' }}>{value}</h3>
            </div>
            <div style={{ background: '#000', color: '#fff', padding: '12px', borderRadius: 0 }}>
                {icon}
            </div>
        </div>
    );
}

function SessionItem({ clientName, trainerName, type, time, date, onClick }: { clientName: string, trainerName?: string, type: string, time: string, date?: string, onClick?: () => void }) {
    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                border: '2px solid #000',
                borderRadius: 0,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '4px 4px 0px #000';
                }
            }}
            onMouseLeave={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                }
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>{clientName}</h4>
                {trainerName && (
                    <p style={{ fontSize: '0.85rem', color: '#555', fontWeight: 600, margin: 0 }}>with {trainerName}</p>
                )}
                <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>{type}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingLeft: '16px', justifyContent: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap' }}>{time}</div>
                {date && <div style={{ fontSize: '0.85rem', color: '#555', fontWeight: 800, whiteSpace: 'nowrap', marginTop: '2px' }}>{date}</div>}
            </div>
        </div>
    );
}
