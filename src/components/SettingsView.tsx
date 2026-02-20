import { Bell, Shield, Smartphone, User, Globe, Moon, Briefcase } from 'lucide-react';
import { ServiceManagement } from './ServiceManagement';

interface SettingsViewProps {
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    onAddService?: () => void;
    onEditService?: (service: any) => void;
}

export const SettingsView = ({ activeTab = 'general', onTabChange, onAddService, onEditService }: SettingsViewProps) => {
    return (
        <div style={{ padding: '40px' }}>
            <header style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Settings</h1>
                <p className="text-muted">Manage your studio configuration and account</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '48px' }}>
                {/* Sidebar Nav */}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div onClick={() => onTabChange?.('general')}>
                        <SettingsNavItem icon={<User size={18} />} label="General" active={activeTab === 'general'} />
                    </div>
                    <div onClick={() => onTabChange?.('services')}>
                        <SettingsNavItem icon={<Briefcase size={18} />} label="Services" active={activeTab === 'services'} />
                    </div>
                    <SettingsNavItem icon={<Bell size={18} />} label="Notifications" />
                    <SettingsNavItem icon={<Shield size={18} />} label="Security" />
                    <SettingsNavItem icon={<Smartphone size={18} />} label="Mobile App" />
                    <SettingsNavItem icon={<Globe size={18} />} label="Integrations" />
                </nav>

                {/* Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    {activeTab === 'services' ? (
                        <ServiceManagement onAddClick={onAddService || (() => { })} onEditClick={onEditService} />
                    ) : (
                        <>
                            <section>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', borderBottom: '2px solid #000', paddingBottom: '12px' }}>Studio Profile</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>STUDIO NAME</label>
                                        <input type="text" defaultValue="Invictus Studio" style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: 0,
                                            border: '2px solid #000',
                                            fontSize: '1rem',
                                            fontWeight: 600
                                        }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>WEBSITE</label>
                                        <input type="text" defaultValue="https://invictus-cal.lovable.app" style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: 0,
                                            border: '2px solid #000',
                                            fontSize: '1rem',
                                            fontWeight: 600
                                        }} />
                                    </div>
                                    <button className="button-primary" style={{ width: 'fit-content', padding: '12px 24px' }}>Save Changes</button>
                                </div>
                            </section>

                            <section>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', borderBottom: '2px solid #000', paddingBottom: '12px' }}>Preferences</h2>
                                <div className="card" style={{ padding: '0' }}>
                                    <PreferenceToggle icon={<Moon size={18} />} title="Theme" description="Switch between light and dark mode" value="Light" />
                                    <div style={{ borderTop: '1px solid #f0f0f0' }}>
                                        <PreferenceToggle icon={<Bell size={18} />} title="Email Updates" description="Receive weekly studio performance metrics" active />
                                    </div>
                                </div>
                            </section>

                            <section style={{ marginTop: '40px' }}>
                                <div style={{
                                    padding: '24px',
                                    background: '#fff',
                                    border: '2px solid #ff4444',
                                    borderRadius: 0,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <h3 style={{ color: '#ff4444', fontWeight: 800, marginBottom: '4px' }}>Danger Zone</h3>
                                        <p className="text-muted" style={{ fontSize: '0.85rem' }}>This will permanently delete authentication records and data.</p>
                                    </div>
                                    <button style={{
                                        background: '#ff4444',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 0,
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}>Delete Account</button>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

function SettingsNavItem({ icon, label, active }: { icon: any, label: string, active?: boolean }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderRadius: 0,
            background: active ? '#000' : 'transparent',
            color: active ? '#fff' : '#000',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem'
        }}>
            {icon}
            <span>{label}</span>
        </div>
    );
}

function PreferenceToggle({ icon, title, description, value, active }: { icon: any, title: string, description: string, value?: string, active?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', background: '#f5f5f5', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
                <div>
                    <h4 style={{ fontWeight: 800 }}>{title}</h4>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>{description}</p>
                </div>
            </div>
            {value ? (
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{value}</span>
            ) : (
                <div style={{
                    width: '48px',
                    height: '24px',
                    background: active ? '#000' : '#e0e0e0',
                    borderRadius: '12px',
                    position: 'relative',
                    cursor: 'pointer'
                }}>
                    <div style={{
                        width: '18px',
                        height: '18px',
                        background: '#fff',
                        borderRadius: 0,
                        position: 'absolute',
                        top: '3px',
                        left: active ? '27px' : '3px',
                        transition: 'all 0.2s ease'
                    }}></div>
                </div>
            )}
        </div>
    );
}
