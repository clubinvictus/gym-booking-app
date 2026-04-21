import { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, Users, Briefcase, Settings, LogOut, Menu, X, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CalendarView } from './CalendarView';
import { ServiceManagement } from './ServiceManagement';
import { ClientManagement } from './ClientManagement';
import { SettingsView } from './SettingsView';
import { useFirestore } from '../hooks/useFirestore';

// New Components
import { TrainerProfile } from './TrainerProfile';
import { ClientProfile } from './ClientProfile';
import { ClientDashboardView } from './ClientDashboardView';
import { ActivityLogView } from './ActivityLogView';
import { useSessions } from '../hooks/useSessions';
import { SessionDetailModal } from './SessionDetailModal';
import { TeamManagement } from './TeamManagement';
import { AddTrainerModal } from './AddTrainerModal';
import { AddManagerModal } from './AddManagerModal';
import { AddClientModal } from './AddClientModal';
import { AddServiceModal } from './AddServiceModal';
import { EditTrainerModal } from './EditTrainerModal';
import { db, auth } from '../firebase';
import { doc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { SITE_ID } from '../constants';
import { signOut } from 'firebase/auth';
import { useAuth } from '../AuthContext';
import { useConfirm } from '../ConfirmContext';
import { TermsModal } from './TermsModal';

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
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();

    // Check if client needs to accept terms
    const showTerms = profile?.role === 'client' && !profile?.termsAccepted;

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
    const { data: clients } = useFirestore<any>('clients');
    
    // Using the centralized useSessions hook for standardized fetching
    const { sessions } = useSessions({
        role: profile?.role as any || 'admin',
        userId: user?.uid || '',
        // Only filter by trainerId if the user IS a trainer (admins/managers see all sessions)
        trainerId: profile?.role === 'trainer' ? profile?.trainerId : undefined,
        pageSize: 100 // High limit for dashboard stats/lists
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
                if (isClient) {
                    return <ClientDashboardView />;
                }

                const now = new Date();
                const todayStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const todayDay = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6

                // Sessions are already filtered by role and endTime > now by useSessions
                const userSessions = sessions || [];

                // Today's sessions: match by date OR day-of-week (for recurring)
                const todaySessions = (userSessions || []).filter((s: any) => {
                    if (!s) return false;
                    
                    if (s.date) {
                        try {
                            const sessionDate = new Date(s.date);
                            if (isNaN(sessionDate.getTime())) return false;
                            return sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) === todayStr;
                        } catch (e) {
                            return false;
                        }
                    }
                    return s.day === todayDay;
                }).sort((a: any, b: any) => {
                    if (!a?.time || !b?.time) return 0;
                    try {
                        const timeA = new Date(`1970/01/01 ${a.time}`).getTime();
                        const timeB = new Date(`1970/01/01 ${b.time}`).getTime();
                        return timeA - timeB;
                    } catch (e) {
                        return 0;
                    }
                });

                // Next Upcoming Sessions (even if not today, to avoid empty dashboard feel)
                const nextSessions = (userSessions || [])
                    .filter((s: any) => !todaySessions.find(ts => ts.id === s.id))
                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .slice(0, 3);

                const myClients = isTrainer ? 
                    clients.filter((c: any) => c.trainerId === profile?.trainerId).length : 
                    clients.length;

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
                        </header>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: '24px',
                            marginBottom: '40px'
                        }}>
                            <StatCard title="TODAY'S SESSIONS" value={todaySessions.length.toString()} icon={<Calendar size={24} />} />
                            {isTrainer && (
                                <StatCard title="MY CLIENTS" value={myClients.toString()} icon={<Users size={24} />} />
                            )}
                            {isAdmin && (
                                <>
                                    <StatCard title="ACTIVE TRAINERS" value={trainers.filter((t: any) => t.status === 'Active').length.toString()} icon={<Users size={24} />} />
                                    <StatCard title="TOTAL CLIENTS" value={clients.length.toString()} icon={<Users size={24} />} />
                                </>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 1024 ? '1fr' : '2fr 1fr', gap: '24px' }}>
                            <div className="card" style={{ padding: '32px' }}>
                                <h2 style={{ marginBottom: '24px', fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}>TODAY'S SESSIONS</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {todaySessions.length > 0 ? todaySessions.map((session: any) => (
                                        <SessionItem
                                            key={session.id}
                                            clientName={session.clientName || session.clients?.[0]?.name || 'Unknown Client'}
                                            trainerName={session.trainerName}
                                            type={session.serviceName}
                                            time={session.time}
                                            onClick={() => setSelectedSession(session)}
                                        />
                                    )) : (
                                        <p className="text-muted" style={{ fontWeight: 500, fontSize: '0.9rem' }}>NO SESSIONS SCHEDULED FOR TODAY.</p>
                                    )}
                                </div>
                            </div>

                            {nextSessions.length > 0 && (
                                <div className="card" style={{ padding: '32px' }}>
                                    <h2 style={{ marginBottom: '24px', fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}>UPCOMING SESSIONS</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {nextSessions.map((session: any) => (
                                            <SessionItem
                                                key={session.id}
                                                clientName={session.clientName || session.clients?.[0]?.name || 'Unknown Client'}
                                                trainerName={session.trainerName}
                                                type={session.serviceName}
                                                time={`${new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} @ ${session.time}`}
                                                onClick={() => setSelectedSession(session)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
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
                flexShrink: 0
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
                        onClick={async () => {
                            await signOut(auth);
                            navigate('/login');
                        }}
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
                        setSelectedSession(null);
                        navigate('/calendar');
                    }}
                />
            )}

            <TermsModal 
                isOpen={showTerms} 
                onAccepted={() => {
                    console.log('Terms accepted');
                }} 
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

function SessionItem({ clientName, trainerName, type, time, onClick }: { clientName: string, trainerName?: string, type: string, time: string, onClick?: () => void }) {
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
            <div style={{ fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap', paddingLeft: '16px' }}>{time}</div>
        </div>
    );
}
