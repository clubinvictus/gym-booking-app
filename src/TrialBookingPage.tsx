import React, { useState, useMemo, useEffect } from 'react';
import { 
    Calendar as CalendarIcon, 
    Clock, 
    User, 
    Mail, 
    Phone, 
    Lock, 
    ChevronLeft, 
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    ArrowRight
} from 'lucide-react';
import { db } from './firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { SITE_ID } from './constants';
import { submitTrialBooking } from './utils/trialBooking';
import { useNavigate } from 'react-router-dom';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00'
];

export const TrialBookingPage = () => {
    const [step, setStep] = useState<'service' | 'calendar' | 'success'>('calendar');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Data state
    const [trialService, setTrialService] = useState<any>(null);
    const [trainers, setTrainers] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [busySlots, setBusySlots] = useState<any[]>([]);
    const [offDays, setOffDays] = useState<any[]>([]);

    // Selection state
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    });
    const [selectedSlot, setSelectedSlot] = useState<{ date: Date, time: string, day: number, availableTrainers: any[] } | null>(null);
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        trainerId: ''
    });

    const navigate = useNavigate();

    // Responsive helper
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [daysToShow, setDaysToShow] = useState(window.innerWidth < 768 ? 3 : 7);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            setDaysToShow(mobile ? 3 : 7);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 1. Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch 'Trial' service (strictly lead-tier)
                const serviceQ = query(
                    collection(db, 'services'), 
                    where('allowed_tiers', 'array-contains', 'lead'),
                    limit(1)
                );
                const serviceSnap = await getDocs(serviceQ);
                
                if (serviceSnap.empty) {
                    setError('Trial service not configured strictly for leads. Please contact support.');
                    return;
                }
                const s = { id: serviceSnap.docs[0].id, ...serviceSnap.docs[0].data() };
                setTrialService(s);

                // Fetch trainers assigned to the trial service
                const trainerIds = s.assigned_trainer_ids || [];
                if (trainerIds.length === 0) {
                    setError('No trainers assigned to the Trial service.');
                    return;
                }

                const trainersSnap = await getDocs(query(collection(db, 'trainers'), where('__name__', 'in', trainerIds.slice(0, 10))));
                setTrainers(trainersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                // Fetch occupied slots and off-days
                const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('siteId', '==', SITE_ID)));
                setSessions(sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                const offDaysSnap = await getDocs(query(collection(db, 'off_days'), where('siteId', '==', SITE_ID)));
                setOffDays(offDaysSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                const busySnap = await getDocs(query(collection(db, 'trainer_busy_slots'), where('siteId', '==', SITE_ID)));
                setBusySlots(busySnap.docs.map(d => ({ id: d.id, ...d.data() })));

            } catch (err: any) {
                console.error('Fetch error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Calendar Helper
    const getSlotAvailability = (date: Date, time: string) => {
        if (!trialService) return [];
        
        const dateStr = date.toISOString().split('T')[0];
        const dateISO = date.toISOString();
        const available: any[] = [];

        for (const trainer of trainers) {
            const isOff = offDays.some(od => od.trainerId === trainer.id && od.date === dateStr);
            if (isOff) continue;

            const isBooked = sessions.some(s => {
                if (s.trainerId !== trainer.id) return false;
                if (s.startTime) {
                    const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
                    const sessionTimeStr = start.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }).replace(/\u202F/g, ' ');
                    return start.toDateString() === date.toDateString() && sessionTimeStr === time;
                }
                return s.time === time && s.date === dateISO;
            });
            if (isBooked) continue;

            const isBusy = busySlots.some(bs => bs.trainerId === trainer.id && bs.time === time && bs.date === dateISO);
            if (isBusy) continue;

            available.push({ id: trainer.id, name: trainer.name });
        }
        return available;
    };

    const handleSlotClick = (date: Date, time: string, availableTrainers: any[]) => {
        if (availableTrainers.length === 0) return;
        
        setSelectedSlot({
            date,
            time,
            day: (date.getDay() + 6) % 7,
            availableTrainers
        });
        
        // Default to first trainer if only one, or leave empty for selection
        setFormData(prev => ({
            ...prev,
            trainerId: availableTrainers.length === 1 ? availableTrainers[0].id : ''
        }));
        
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlot || !trialService || !formData.trainerId) return;

        const selectedTrainer = selectedSlot.availableTrainers.find(t => t.id === formData.trainerId);
        if (!selectedTrainer) return;

        setSubmitting(true);
        setError(null);

        try {
            await submitTrialBooking({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
                slot: {
                    date: selectedSlot.date.toISOString(),
                    time: selectedSlot.time,
                    trainerId: selectedTrainer.id,
                    trainerName: selectedTrainer.name,
                    day: selectedSlot.day
                },
                service: {
                    id: trialService.id,
                    name: trialService.name
                }
            });
            setIsModalOpen(false);
            setStep('success');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                <p style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#fff' }}>Loading trial calendar...</p>
            </div>
        );
    }

    if (error && !trialService) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '40px', textAlign: 'center', color: '#fff' }}>
                <AlertCircle size={48} color="#fff" style={{ marginBottom: '20px' }} />
                <h2 style={{ fontWeight: 900, marginBottom: '12px', textTransform: 'uppercase' }}>CONFIGURATION ERROR</h2>
                <p style={{ maxWidth: '400px', fontWeight: 600 }}>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <header className="trial-header">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '16px' }}>
                    <img 
                        src="/logo white.png" 
                        alt="Invictus" 
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                        }}
                        style={{ maxWidth: '140px', height: 'auto' }} 
                        className="trial-logo"
                    />
                    <div className="logo-fallback" style={{ display: 'none', width: '60px', height: '60px', border: '4px solid #fff', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                        <span style={{ fontWeight: 900, fontSize: '2rem' }}>I</span>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
                {step === 'calendar' && (
                    <div className="fade-in">
                        <div className="banner-container">
                            <h1 className="banner-title">BOOK YOUR TRIAL</h1>
                            <p className="banner-subtitle" style={{ color: '#888' }}>
                                Select a time slot that works for you. Your first step towards a limitless version of yourself begins here.
                            </p>
                        </div>

                        <div style={{ background: '#000', border: '2px solid #333', padding: '0', borderRadius: '8px', overflow: 'hidden' }}>
                            <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '2px solid #333' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase' }}>SELECT A TIME</h3>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => {
                                                const d = new Date(currentWeekStart);
                                                d.setDate(d.getDate() - daysToShow);
                                                setCurrentWeekStart(d);
                                            }}
                                            style={{ padding: '8px', background: 'transparent', border: '2px solid #fff', cursor: 'pointer', color: '#fff', borderRadius: '6px' }}
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const d = new Date(currentWeekStart);
                                                d.setDate(d.getDate() + daysToShow);
                                                setCurrentWeekStart(d);
                                            }}
                                            style={{ padding: '8px', background: 'transparent', border: '2px solid #fff', cursor: 'pointer', color: '#fff', borderRadius: '6px' }}
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '2px' }}></div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>AVAILABLE</span>
                                </div>
                            </div>

                            <div style={{ overflowX: 'hidden' }}>
                                <div style={{ 
                                    width: '100%', 
                                    display: 'grid', 
                                    gridTemplateColumns: `${isMobile ? '60px' : '80px'} repeat(${daysToShow}, 1fr)` 
                                }}>
                                    <div style={{ borderRight: '1px solid #333' }}></div>
                                    {DAYS.slice(0, daysToShow).map((day, i) => {
                                        const date = new Date(currentWeekStart);
                                        date.setDate(date.getDate() + i);
                                        const isToday = date.toDateString() === new Date().toDateString();
                                        return (
                                            <div key={day} style={{ padding: isMobile ? '8px 4px' : '16px', borderRight: '1px solid #333', textAlign: 'center', background: isToday ? '#111' : 'transparent' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#666', textTransform: 'uppercase' }}>{day}</div>
                                                <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 900 }}>{date.getDate()}</div>
                                            </div>
                                        );
                                    })}

                                    {TIME_SLOTS.map(time => (
                                        <React.Fragment key={time}>
                                            <div style={{ padding: isMobile ? '12px 4px' : '20px', fontSize: '0.75rem', fontWeight: 900, borderTop: '1px solid #333', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {time}
                                            </div>
                                            {Array.from({ length: daysToShow }).map((_, i) => {
                                                const date = new Date(currentWeekStart);
                                                date.setDate(date.getDate() + i);
                                                
                                                // Create a precise timestamp for this slot to check against "now"
                                                const [hours, minutes] = time.split(':').map(Number);
                                                const slotDateTime = new Date(date);
                                                slotDateTime.setHours(hours, minutes, 0, 0);
                                                
                                                const isPast = slotDateTime < new Date();
                                                const availableTrainers = getSlotAvailability(date, time);
                                                const isAvailable = availableTrainers.length > 0 && !isPast;

                                                return (
                                                    <div 
                                                        key={`${i}-${time}`}
                                                        onClick={() => isAvailable && handleSlotClick(date, time, availableTrainers)}
                                                        style={{ 
                                                            minHeight: '80px', 
                                                            borderTop: '1px solid #333', 
                                                            borderRight: '1px solid #333',
                                                            background: isAvailable ? '#000' : '#0a0a0a',
                                                            cursor: isAvailable ? 'pointer' : 'default',
                                                            padding: '4px',
                                                            transition: 'all 0.2s',
                                                            position: 'relative',
                                                            opacity: isPast ? 0.2 : 1,
                                                            pointerEvents: isPast ? 'none' : 'auto'
                                                        }}
                                                        className={isAvailable ? 'calendar-cell available' : 'calendar-cell'}
                                                    >
                                                        {isAvailable && (
                                                            <div className="book-btn" style={{ height: '100%', border: 'none', background: '#fff', color: '#000', display: 'none', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, borderRadius: '4px' }}>
                                                                BOOK
                                                            </div>
                                                        )}
                                                        {!isAvailable && isPast && (
                                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#333', textTransform: 'uppercase' }}>
                                                                PAST
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isModalOpen && selectedSlot && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
                        <div className="fade-in" style={{ width: '100%', maxWidth: '500px', background: '#000', border: '4px solid #fff', padding: '40px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px', textTransform: 'uppercase' }}>BOOKING TRIAL</h1>
                                <p style={{ fontWeight: 900, background: '#fff', color: '#000', display: 'inline-block', padding: '4px 12px', fontSize: '0.9rem', textTransform: 'uppercase', borderRadius: '2px' }}>
                                    {DAYS[selectedSlot.day]} {selectedSlot.date.getDate()} @ {selectedSlot.time}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {error && (
                                    <div style={{ padding: '12px', background: 'transparent', border: '2px solid #ff4444', color: '#ff4444', fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px' }}>
                                        <AlertCircle size={16} />
                                        <span style={{ textTransform: 'uppercase' }}>{error}</span>
                                    </div>
                                )}

                                <div>
                                    <label style={{ display: 'block', fontWeight: 900, fontSize: '0.75rem', marginBottom: '12px', color: '#666', textTransform: 'uppercase' }}>1. Choose Trainer</label>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '0', top: '14px', color: '#fff' }}><User size={18} /></div>
                                        <select
                                            required
                                            value={formData.trainerId}
                                            onChange={e => setFormData({...formData, trainerId: e.target.value})}
                                            className="noir-input"
                                            style={{ 
                                                width: '100%', 
                                                padding: '12px 12px 12px 32px', 
                                                border: 'none',
                                                borderBottom: '2px solid #fff',
                                                borderRadius: '6px', 
                                                fontSize: '1rem', 
                                                fontWeight: 900,
                                                appearance: 'none',
                                                background: '#111',
                                                color: '#fff',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="" style={{ background: '#000', color: '#fff' }}>SELECT TRAINER...</option>
                                            {selectedSlot.availableTrainers.map(t => (
                                                <option key={t.id} value={t.id} style={{ background: '#000', color: '#fff' }}>{t.name.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', fontWeight: 900, fontSize: '0.75rem', marginBottom: '24px', color: '#666', textTransform: 'uppercase' }}>2. Your Details</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div style={{ borderBottom: '2px solid #fff', borderRadius: '6px', background: '#111', padding: '12px' }}>
                                            <label style={{ display: 'block', fontWeight: 900, fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Name</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={formData.name}
                                                onChange={e => setFormData({...formData, name: e.target.value})}
                                                className="noir-input"
                                                style={{ width: '100%', padding: '0', border: 'none', background: 'transparent', color: '#fff', fontSize: '1rem', fontWeight: 700 }}
                                                placeholder="FULL NAME" 
                                            />
                                        </div>

                                        <div style={{ borderBottom: '2px solid #fff', borderRadius: '6px', background: '#111', padding: '12px' }}>
                                            <label style={{ display: 'block', fontWeight: 900, fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Email</label>
                                            <input 
                                                type="email" 
                                                required
                                                value={formData.email}
                                                onChange={e => setFormData({...formData, email: e.target.value})}
                                                className="noir-input"
                                                style={{ width: '100%', padding: '0', border: 'none', background: 'transparent', color: '#fff', fontSize: '1rem', fontWeight: 700 }}
                                                placeholder="EMAIL@EXAMPLE.COM" 
                                            />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                            <div style={{ borderBottom: '2px solid #fff', borderRadius: '6px', background: '#111', padding: '12px' }}>
                                                <label style={{ display: 'block', fontWeight: 900, fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Phone</label>
                                                <input 
                                                    type="tel" 
                                                    required
                                                    value={formData.phone}
                                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                                    className="noir-input"
                                                    style={{ width: '100%', padding: '0', border: 'none', background: 'transparent', color: '#fff', fontSize: '1rem', fontWeight: 700 }}
                                                    placeholder="+91 XXXX" 
                                                />
                                            </div>
                                            <div style={{ borderBottom: '2px solid #fff', borderRadius: '6px', background: '#111', padding: '12px' }}>
                                                <label style={{ display: 'block', fontWeight: 900, fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Password</label>
                                                <input 
                                                    type="password" 
                                                    required
                                                    value={formData.password}
                                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                                    className="noir-input"
                                                    style={{ width: '100%', padding: '0', border: 'none', background: 'transparent', color: '#fff', fontSize: '1rem', fontWeight: 700 }}
                                                    placeholder="••••••••" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    style={{ 
                                        width: '100%', 
                                        padding: '20px', 
                                        background: '#fff', 
                                        color: '#000', 
                                        fontWeight: 900, 
                                        border: 'none', 
                                        cursor: 'pointer', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: '8px', 
                                        fontSize: '1.2rem', 
                                        marginTop: '10px',
                                        textTransform: 'uppercase',
                                        borderRadius: '6px'
                                    }}
                                >
                                    {submitting ? 'RESERVING...' : 'CONFIRM TRIAL'}
                                </button>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#666', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginTop: '10px' }}>CANCEL</button>
                            </form>
                        </div>
                    </div>
                )}

                {step === 'success' && (
                    <div className="fade-in" style={{ textAlign: 'center', maxWidth: '600px', margin: '100px auto' }}>
                        <div style={{ marginBottom: '32px' }}>
                            <CheckCircle2 size={80} color="#fff" style={{ margin: '0 auto' }} />
                        </div>
                        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '16px', textTransform: 'uppercase' }}>You are locked in!</h1>
                        <p style={{ fontSize: '1.2rem', color: '#666', fontWeight: 600, marginBottom: '40px', textTransform: 'uppercase' }}>
                            Check your WhatsApp for confirmation. We will call you shortly.
                        </p>
                        <button 
                            onClick={() => navigate('/login')}
                            style={{ padding: '20px 40px', background: '#fff', color: '#000', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: '6px' }}
                        >
                            GO TO DASHBOARD
                        </button>
                    </div>
                )}
            </main>

            <style>{`
                .fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                .calendar-cell.available:hover {
                    background: #111 !important;
                }
                
                .calendar-cell.available:hover .book-btn {
                    display: flex !important;
                }

                .noir-input:focus {
                    outline: 2px solid #fff !important;
                    outline-offset: 4px;
                }

                ::placeholder {
                    color: #444;
                    opacity: 1;
                }

                select::-ms-expand {
                    display: none;
                }
                
                /* Removing default browser touches */
                * {
                    -webkit-tap-highlight-color: transparent;
                }

                /* Header & Banner Styles */
                .trial-header {
                    padding: 24px 16px;
                    background: #000;
                    border-bottom: 2px solid #111;
                }

                .banner-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    margin-bottom: 60px;
                    padding: 0 16px;
                }

                .banner-title {
                    font-size: 3.5rem;
                    font-weight: 900;
                    letter-spacing: -2px;
                    margin-bottom: 16px;
                    text-transform: uppercase;
                    line-height: 1;
                    color: #fff;
                }

                .banner-subtitle {
                    font-size: 1.1rem;
                    font-weight: 600;
                    max-width: 600px;
                    margin: 0 auto;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                /* Mobile Responsiveness (Pixel-Perfect) */
                @media (max-width: 768px) {
                    .trial-header {
                        padding: 16px 16px;
                    }

                    .trial-logo {
                        max-width: 120px !important;
                    }

                    .banner-container {
                        margin-bottom: 40px;
                    }

                    .banner-title {
                        font-size: 2.2rem;
                        letter-spacing: -1px;
                    }

                    .banner-subtitle {
                        font-size: 0.85rem;
                        padding: 0 8px;
                    }

                    .calendar-header h3 {
                        font-size: 1rem !important;
                    }
                }
            `}</style>
        </div>
    );
};
