import { useState } from 'react';
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
import { TeamManagement } from './TeamManagement';
import { AddTrainerModal } from './AddTrainerModal';
import { AddManagerModal } from './AddManagerModal';
import { AddServiceModal } from './AddServiceModal';
import { EditTrainerModal } from './EditTrainerModal';
import { seedInitialData } from '../seed';
import { db, auth } from '../firebase';
import { doc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { SITE_ID } from '../constants';
import { useAuth } from '../AuthContext';
import { signOut } from 'firebase/auth';

interface DashboardProps {
    view?: 'dashboard' | 'calendar' | 'team' | 'services' | 'clients' | 'activity' | 'settings';
}

export const Dashboard = ({ view = 'dashboard' }: DashboardProps) => {
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [trainerModalOpen, setTrainerModalOpen] = useState(false);
    const [managerModalOpen, setManagerModalOpen] = useState(false);
    const [editTrainerOpen, setEditTrainerOpen] = useState(false);
    const [serviceModalOpen, setServiceModalOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [settingsTab, setSettingsTab] = useState('general');
    const [isSeeding, setIsSeeding] = useState(false);
    const { profile } = useAuth();
    const navigate = useNavigate();

    const isAdmin = profile?.role === 'admin';
    const isManager = profile?.role === 'manager';
    const isTrainer = profile?.role === 'trainer';
    const isClient = profile?.role === 'client';

    // Use Firestore for stats
    const { data: trainers } = useFirestore<any>('trainers');
    const { data: clients } = useFirestore<any>('clients');
    const { data: sessions } = useFirestore<any>('sessions');

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            await seedInitialData();
            alert('Success: Database seeded with initial trainers, services, and clients.');
        } catch (error) {
            console.error(error);
            alert('Error seeding database. Make sure your Firestore is in Test Mode.');
        } finally {
            setIsSeeding(false);
        }
    };

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
                            if (window.confirm('Are you sure you want to remove this manager?')) {
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
                return <ClientManagement onClientClick={handleClientClick} />;
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

                // Filter sessions if trainer
                const displaySessions = isTrainer
                    ? sessions.filter(s => s.trainerId === profile.trainerId)
                    : sessions;

                return (
                    <div style={{ padding: '40px' }}>
                        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Dashboard</h1>
                                <p className="text-muted">Welcome back, {profile?.name || 'User'}! Here's what's happening Today.</p>
                            </div>
                            {isAdmin && !isManager && (
                                <button
                                    onClick={handleSeedData}
                                    className="button-secondary"
                                    disabled={isSeeding}
                                    style={{ opacity: isSeeding ? 0.5 : 1 }}
                                >
                                    {isSeeding ? 'Seeding...' : 'Seed Initial Data'}
                                </button>
                            )}
                        </header>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: '24px',
                            marginBottom: '40px'
                        }}>
                            <StatCard title="Today's Sessions" value={displaySessions.length.toString()} icon={<Calendar size={24} />} />
                            {isAdmin && (
                                <>
                                    <StatCard title="Active Trainers" value={trainers.filter(t => t.status === 'Active').length.toString()} icon={<Users size={24} />} />
                                    <StatCard title="Total Clients" value={clients.length.toString()} icon={<Users size={24} />} />
                                </>
                            )}
                        </div>

                        <div className="card" style={{ padding: '32px' }}>
                            <h2 style={{ marginBottom: '24px' }}>Upcoming Sessions</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {displaySessions.length > 0 ? displaySessions.map(session => (
                                    <SessionItem key={session.id} name={session.clientName} type={session.serviceName} time={session.time} />
                                )) : (
                                    <p className="text-muted">No sessions scheduled for today.</p>
                                )}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="app-container" style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
            <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'} `} style={{
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
                    <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '16px', height: '16px', background: '#000', borderRadius: 0 }}></div>
                    </div>
                    {isSidebarOpen && <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.05em' }}>INVICTUS</span>}
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div onClick={() => { navigate('/dashboard'); setSelectedTrainerId(null); setSelectedClient(null); }}>
                        <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={view === 'dashboard'} isOpen={isSidebarOpen} />
                    </div>
                    <div onClick={() => { navigate('/calendar'); setSelectedTrainerId(null); setSelectedClient(null); }}>
                        <NavItem icon={<Calendar size={20} />} label="Calendar" active={view === 'calendar'} isOpen={isSidebarOpen} />
                    </div>
                    {(isAdmin || isManager) && (
                        <>
                            <div onClick={() => { navigate('/team'); setSelectedTrainerId(null); setSelectedClient(null); }}>
                                <NavItem icon={<Users size={20} />} label="Team" active={view === 'team'} isOpen={isSidebarOpen} />
                            </div>
                            <div onClick={() => { navigate('/services'); setSelectedTrainerId(null); setSelectedClient(null); }}>
                                <NavItem icon={<Briefcase size={20} />} label="Services" active={view === 'services'} isOpen={isSidebarOpen} />
                            </div>
                            <div onClick={() => { navigate('/clients'); setSelectedTrainerId(null); setSelectedClient(null); }}>
                                <NavItem icon={<Users size={20} />} label="Clients" active={view === 'clients'} isOpen={isSidebarOpen} />
                            </div>
                            <div onClick={() => { navigate('/activity'); setSelectedTrainerId(null); setSelectedClient(null); }}>
                                <NavItem icon={<Clock size={20} />} label="Activity Log" active={view === 'activity'} isOpen={isSidebarOpen} />
                            </div>
                        </>
                    )}
                </nav>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div onClick={() => { navigate('/settings'); setSelectedTrainerId(null); setSelectedClient(null); }}>
                        <NavItem icon={<Settings size={20} />} label="Settings" active={view === 'settings'} isOpen={isSidebarOpen} />
                    </div>
                    <button
                        onClick={async () => {
                            await signOut(auth);
                            navigate('/login');
                        }}
                        style={{ background: 'transparent', border: 'none', padding: 0, width: '100%', textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
                    >
                        <NavItem icon={<LogOut size={20} />} label="Logout" isOpen={isSidebarOpen} />
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 10
                    }}
                >
                    {isSidebarOpen ? <X size={14} /> : <Menu size={14} />}
                </button>
            </aside>

            <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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

function SessionItem({ name, type, time }: { name: string, type: string, time: string }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            border: '2px solid #000',
            borderRadius: 0
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', background: '#000', borderRadius: 0 }}></div>
                <div>
                    <h4 style={{ fontSize: '1rem' }}>{name}</h4>
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>{type}</p>
                </div>
            </div>
            <div style={{ fontWeight: 800 }}>{time}</div>
        </div>
    );
}
