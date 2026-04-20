import { useState, useEffect } from 'react';
import { Bell, Moon, User, Layout, Database, Shield, Trash2, Briefcase, Wrench } from 'lucide-react';
import { ServiceManagement } from './ServiceManagement';
import { healSessions } from '../services/SessionHealer';
import { purgeAllSessions } from '../services/SessionPurger';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

interface SettingsViewProps {
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    onAddService?: () => void;
    onEditService?: (service: any) => void;
}

export const SettingsView = ({ activeTab = 'general', onTabChange, onAddService, onEditService }: SettingsViewProps) => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [isPurgeModalOpen, setPurgeModalOpen] = useState(false);
    
    const userRole = (profile?.role || '').toLowerCase();
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';
    const isTrainer = userRole === 'trainer';
    const isClient = userRole === 'client';

    // 1. Trainer Guard: Trainers should not be in settings
    useEffect(() => {
        if (isTrainer) {
            navigate('/dashboard');
        }
    }, [isTrainer, navigate]);

    if (isTrainer) return null;

    return (
        <div style={{ padding: window.innerWidth <= 768 ? '24px 16px' : '40px' }}>
            <header style={{ marginBottom: '40px' }}>
                <h1 style={{ 
                    fontSize: window.innerWidth <= 768 ? '2rem' : '2.5rem', 
                    marginBottom: '8px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                }}>Settings</h1>
                <p className="text-muted">
                    {isClient ? 'Manage your personal profile' : 'Manage your studio configuration and account'}
                </p>
            </header>

            <div style={{
                display: 'grid',
                gridTemplateColumns: window.innerWidth <= 768 || isClient ? '1fr' : '250px 1fr',
                gap: window.innerWidth <= 768 ? '32px' : '48px'
            }}>
                {/* Sidebar Nav - Hidden for Clients (only one context) */}
                {!isClient && (
                    <nav style={{
                        display: 'flex',
                        flexDirection: window.innerWidth <= 768 ? 'row' : 'column',
                        gap: '8px',
                        overflowX: window.innerWidth <= 768 ? 'auto' : 'visible',
                        paddingBottom: window.innerWidth <= 768 ? '8px' : '0',
                        borderBottom: window.innerWidth <= 768 ? '2px solid #eee' : 'none'
                    }}>
                        <div onClick={() => onTabChange?.('general')}>
                            <SettingsNavItem icon={<User size={18} />} label="General" active={activeTab === 'general'} />
                        </div>
                        <div onClick={() => onTabChange?.('services')}>
                            <SettingsNavItem icon={<Briefcase size={18} />} label="Services" active={activeTab === 'services'} />
                        </div>
                        {isAdmin && (
                            <div onClick={() => onTabChange?.('maintenance')}>
                                <SettingsNavItem icon={<Wrench size={18} />} label="Maintenance" active={activeTab === 'maintenance'} />
                            </div>
                        )}
                        <SettingsNavItem icon={<Bell size={18} />} label="Notifications" />
                        <SettingsNavItem icon={<Shield size={18} />} label="Security" />
                    </nav>
                )}

                {/* Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    
                    {/* 1. Maintenance Section (Admin Only) */}
                    {activeTab === 'maintenance' && isAdmin && (
                        <section>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '24px', borderBottom: '2px solid #000', paddingBottom: '12px', textTransform: 'uppercase' }}>Database Maintenance</h2>
                            <div style={{ padding: '24px', background: '#f9f9f9', border: '2px solid #000', marginBottom: '32px' }}>
                                <h3 style={{ marginBottom: '8px', fontWeight: 700 }}>Repair Session Integrity</h3>
                                <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.9rem' }}>
                                    Audit and fix missing site metadata or identification mismatches in the sessions collection.
                                </p>
                                <button 
                                    onClick={async () => {
                                        if (window.confirm('Start healing process?')) {
                                            await healSessions();
                                            window.alert('Healing complete!');
                                        }
                                    }}
                                    className="button-primary" 
                                    style={{ width: 'fit-content', padding: '12px 24px', background: '#000' }}
                                >
                                    Run Session Healer
                                </button>
                            </div>

                            <div style={{ padding: '24px', background: '#fff0f0', border: '2px solid #ff0000' }}>
                                <h3 style={{ marginBottom: '8px', color: '#ff0000', fontWeight: 700 }}>Factory Reset: Sessions</h3>
                                <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.9rem' }}>
                                    <strong>WARNING:</strong> This will permanently delete ALL session data. Accounts remain intact.
                                </p>
                                <button 
                                    onClick={() => setPurgeModalOpen(true)}
                                    className="button-primary" 
                                    style={{ width: 'fit-content', padding: '12px 24px', background: '#ff0000', color: '#fff' }}
                                >
                                    Purge All Sessions
                                </button>
                            </div>
                        </section>
                    )}

                    {/* 2. Services Section (Admin/Manager) */}
                    {activeTab === 'services' && !isClient && (
                        <ServiceManagement onAddClick={onAddService || (() => { })} onEditClick={onEditService} />
                    )}

                    {/* 3. General / Profile Section */}
                    {activeTab === 'general' && (
                        <>
                            {/* Studio Profile (Staff Only) */}
                            {!isClient && (
                                <section>
                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '24px', borderBottom: '2px solid #000', paddingBottom: '12px', textTransform: 'uppercase' }}>Studio Profile</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.8rem' }}>STUDIO NAME</label>
                                            <input type="text" defaultValue="Invictus Studio" style={{ width: '100%', padding: '12px', border: '2px solid #000', borderRadius: 0, fontWeight: 600 }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.8rem' }}>WEBSITE</label>
                                            <input type="text" defaultValue="https://invictus-cal.lovable.app" style={{ width: '100%', padding: '12px', border: '2px solid #000', borderRadius: 0, fontWeight: 600 }} />
                                        </div>
                                        <button className="button-primary" style={{ width: 'fit-content', padding: '12px 24px' }}>Save Changes</button>
                                    </div>
                                </section>
                            )}

                            {/* Personal Profile (Everyone remaining: Admin, Manager, Client) */}
                            <section>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '24px', borderBottom: '2px solid #000', paddingBottom: '12px', textTransform: 'uppercase' }}>Personal Profile</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.8rem' }}>FULL NAME</label>
                                        <input type="text" defaultValue={profile?.name || ''} style={{ width: '100%', padding: '12px', border: '2px solid #000', borderRadius: 0, fontWeight: 600 }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.8rem' }}>EMAIL ADDRESS</label>
                                        <input type="email" defaultValue={profile?.email || ''} style={{ width: '100%', padding: '12px', border: '2px solid #000', borderRadius: 0, fontWeight: 600, backgroundColor: '#f9f9f9', color: '#666' }} disabled />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.8rem' }}>PHONE NUMBER</label>
                                        <input type="tel" defaultValue={profile?.phone || ''} placeholder="Add phone number..." style={{ width: '100%', padding: '12px', border: '2px solid #000', borderRadius: 0, fontWeight: 600 }} />
                                    </div>
                                    <button className="button-primary" style={{ width: 'fit-content', padding: '12px 24px' }}>Update Profile</button>
                                </div>
                            </section>

                            {!isClient && (
                                <section>
                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '24px', borderBottom: '2px solid #000', paddingBottom: '12px', textTransform: 'uppercase' }}>Preferences</h2>
                                    <div className="card" style={{ padding: '0' }}>
                                        <PreferenceToggle icon={<Moon size={18} />} title="Theme" description="Switch between light and dark mode" value="Light" />
                                        <div style={{ borderTop: '1px solid #f0f0f0' }}>
                                            <PreferenceToggle icon={<Bell size={18} />} title="Email Updates" description="Receive weekly studio performance metrics" active />
                                        </div>
                                    </div>
                                </section>
                            )}

                            <section style={{ marginTop: '40px' }}>
                                <div style={{ padding: '24px', background: '#fff', border: '2px solid #ff4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                                    <div>
                                        <h3 style={{ color: '#ff4444', fontWeight: 800, textTransform: 'uppercase' }}>Danger Zone</h3>
                                        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Permanently delete your account and associated data.</p>
                                    </div>
                                    <button style={{ background: '#ff4444', color: '#fff', padding: '12px 24px', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Delete Account</button>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>

            {/* Custom Noir Purge Modal (Admin Only) */}
            {isPurgeModalOpen && isAdmin && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '24px' }}>
                    <div style={{ maxWidth: '500px', width: '100%', backgroundColor: '#111', border: '4px solid #fff', padding: '40px', textAlign: 'center' }}>
                        <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 900, marginBottom: '24px', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>Critical Action</h2>
                        <p style={{ color: '#888', marginBottom: '32px', fontSize: '1.1rem', lineHeight: '1.6' }}>You are about to permanently delete **ALL SESSIONS**. This cannot be undone.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <button onClick={async () => { setPurgeModalOpen(false); const count = await purgeAllSessions(); window.alert(`Purge complete! ${count} sessions removed.`); }} style={{ backgroundColor: '#ff0000', color: '#fff', border: 'none', padding: '20px', fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase' }}>Confirm Final Purge</button>
                            <button onClick={() => setPurgeModalOpen(false)} style={{ backgroundColor: 'transparent', color: '#fff', border: '2px solid #fff', padding: '16px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function SettingsNavItem({ icon, label, active }: { icon: any, label: string, active?: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: active ? '#000' : 'transparent', color: active ? '#fff' : '#000', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase' }}>
            {icon}
            <span>{label}</span>
        </div>
    );
}

function PreferenceToggle({ icon, title, description, value, active }: { icon: any, title: string, description: string, value?: string, active?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
                <div>
                    <h4 style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.85rem' }}>{title}</h4>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>{description}</p>
                </div>
            </div>
            {value ? (<span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{value}</span>) : (
                <div style={{ width: '48px', height: '24px', background: active ? '#000' : '#e0e0e0', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
                    <div style={{ width: '18px', height: '18px', background: '#fff', position: 'absolute', top: '3px', left: active ? '27px' : '3px', transition: 'all 0.2s ease' }}></div>
                </div>
            )}
        </div>
    );
}
