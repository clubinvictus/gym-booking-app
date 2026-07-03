import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    User, 
    ChevronLeft, 
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    Eye,
    EyeOff
} from 'lucide-react';
import { db } from './firebase';
import { collection, getDocs, query, where, onSnapshot, QuerySnapshot, type DocumentData } from 'firebase/firestore';
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
    const [showPassword, setShowPassword] = useState(false);
    
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
        let unsubSessions: (() => void) | null = null;
        let unsubOffDays: (() => void) | null = null;
        let unsubBusySlots: (() => void) | null = null;

        const fetchData = async () => {
            try {
                // Fetch service info
                const qAllServices = query(
                    collection(db, 'services'),
                    where('siteId', '==', SITE_ID)
                );
                const allServicesSnap = await getDocs(qAllServices);
                let targetDoc = allServicesSnap.docs.find(d => d.data().isTrial === true || d.data().allowed_tiers?.includes('lead'));
                if (!targetDoc) {
                    targetDoc = allServicesSnap.docs.find(d => d.data().name?.toLowerCase().includes('trial'));
                }
                
                if (!targetDoc) {
                    setError('Trial service not configured for this site.');
                    return;
                }

                const s = { id: targetDoc.id, ...(targetDoc.data() as any) };
                setTrialService(s);

                // Fetch trainers for the site
                const trainersSnap = await getDocs(query(collection(db, 'trainers'), where('siteId', '==', SITE_ID)));
                setTrainers(trainersSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((t: any) => t.status !== 'Inactive'));

                // Use real-time listeners for dynamic availability data
                unsubSessions = onSnapshot(query(collection(db, 'sessions'), where('siteId', '==', SITE_ID)), (snap: QuerySnapshot<DocumentData>) => {
                    setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                });

                unsubOffDays = onSnapshot(query(collection(db, 'off_days'), where('siteId', '==', SITE_ID)), (snap: QuerySnapshot<DocumentData>) => {
                    setOffDays(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                });

                unsubBusySlots = onSnapshot(query(collection(db, 'trainer_busy_slots'), where('siteId', '==', SITE_ID)), (snap: QuerySnapshot<DocumentData>) => {
                    setBusySlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                });

            } catch (err: any) {
                console.error('Fetch error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Cleanup listeners on unmount
        return () => {
            if (unsubSessions) unsubSessions();
            if (unsubOffDays) unsubOffDays();
            if (unsubBusySlots) unsubBusySlots();
        };
    }, []);

    // Pre-calculate lookup maps and eligible trainers in useMemo to avoid massive O(n^2) calculations on re-render
    const eligibleTrainers = useMemo(() => {
        if (!trialService) return [];
        const assignedIds = trialService.assigned_trainer_ids || trialService.assignedTrainerIds || [];
        return trainers.filter(trainer => {
            const isAssigned = assignedIds.includes(trainer.id);
            const hasTrialSpecialty = trainer.specialties?.some((sp: string) => 
                sp === trialService.name || sp.toLowerCase().includes('trial')
            );
            return isAssigned || hasTrialSpecialty;
        });
    }, [trainers, trialService]);

    const offDaysMap = useMemo(() => {
        const set = new Set<string>();
        offDays.forEach(od => {
            if (od.trainerId && od.date) set.add(`${od.trainerId}_${od.date}`);
        });
        return set;
    }, [offDays]);

    const busySlotsMap = useMemo(() => {
        const set = new Set<string>();
        busySlots.forEach(bs => {
            if (bs.trainerId && bs.time && bs.date) {
                const dStr = bs.date.split('T')[0];
                set.add(`${bs.trainerId}_${dStr}_${bs.time}`);
            }
        });
        return set;
    }, [busySlots]);

    const parsedSessions = useMemo(() => {
        return sessions.map(s => {
            let dateStr = '';
            let timeStr = s.time || '';
            if (s.startTime) {
                const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
                dateStr = start.toDateString();
                const h = String(start.getHours()).padStart(2, '0');
                const m = String(start.getMinutes()).padStart(2, '0');
                timeStr = `${h}:${m}`;
            } else if (s.date) {
                const start = new Date(s.date);
                dateStr = start.toDateString();
            }
            return {
                trainerId: s.trainerId,
                serviceId: s.serviceId,
                clientCount: s.clients?.length || 1,
                dateStr,
                timeStr
            };
        });
    }, [sessions]);

    const convertTo24h = useCallback((tStr: string) => {
        if (!tStr) return '';
        if (tStr.includes('AM') || tStr.includes('PM')) {
            const [t, m] = tStr.split(' ');
            let [h, min] = t.split(':');
            if (h === '12') h = '00';
            if (m === 'PM') h = String(parseInt(h, 10) + 12).padStart(2, '0');
            return `${h.padStart(2, '0')}:${min}`;
        }
        return tStr;
    }, []);

    // Calendar Helper
    const getSlotAvailability = useCallback((date: Date, time: string) => {
        if (!trialService || eligibleTrainers.length === 0) return [];
        
        const dateStr = date.toISOString().split('T')[0];
        const dateToDateStr = date.toDateString();
        const available: any[] = [];
        const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = daysMap[date.getDay()];
        const slotTime = convertTo24h(time);

        for (const trainer of eligibleTrainers) {
            const daySchedule = trainer.availability?.[dayName];
            if (!daySchedule || !daySchedule.active) continue;

            let isWorking = false;
            if (daySchedule.shifts && Array.isArray(daySchedule.shifts)) {
                isWorking = daySchedule.shifts.some((shift: any) => {
                    const start = convertTo24h(shift.start);
                    const end = convertTo24h(shift.end);
                    return slotTime >= start && slotTime < end;
                });
            } else if (daySchedule.start && daySchedule.end) {
                const start = convertTo24h(daySchedule.start);
                const end = convertTo24h(daySchedule.end);
                isWorking = slotTime >= start && slotTime < end;
            }
            if (!isWorking) continue;

            if (offDaysMap.has(`${trainer.id}_${dateStr}`)) continue;
            if (busySlotsMap.has(`${trainer.id}_${dateStr}_${time}`)) continue;

            // Check existing sessions
            const existing = parsedSessions.filter(s => s.trainerId === trainer.id && s.dateStr === dateToDateStr && s.timeStr === time);
            let hasConflict = false;
            if (existing.length > 0) {
                const session = existing[0];
                const maxCap = trialService.max_capacity || 1;
                if (session.clientCount >= maxCap || session.serviceId !== trialService.id) {
                    hasConflict = true;
                }
            }
            if (hasConflict) continue;

            available.push({ id: trainer.id, name: trainer.name });
        }
        return available;
    }, [trialService, eligibleTrainers, offDaysMap, busySlotsMap, parsedSessions, convertTo24h]);

    const gridAvailability = useMemo(() => {
        const map: { [key: string]: any[] } = {};
        for (let i = 0; i < daysToShow; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);
            for (const time of TIME_SLOTS) {
                map[`${i}-${time}`] = getSlotAvailability(date, time);
            }
        }
        return map;
    }, [currentWeekStart, daysToShow, getSlotAvailability]);

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
        
        setShowPassword(false); // Reset password visibility when opening modal
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
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                <p style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#000' }}>Loading trial calendar...</p>
            </div>
        );
    }

    if (error && !trialService) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '40px', textAlign: 'center', color: '#000' }}>
                <AlertCircle size={48} color="#000" style={{ marginBottom: '20px' }} />
                <h2 style={{ fontWeight: 900, marginBottom: '12px', textTransform: 'uppercase' }}>CONFIGURATION ERROR</h2>
                <p style={{ maxWidth: '400px', fontWeight: 600 }}>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#fff', color: '#000', fontFamily: 'Inter, sans-serif' }}>
            <header className="trial-header">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '16px' }}>
                    <img 
                        src="/logo black.png" 
                        alt="Invictus" 
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                        }}
                        style={{ maxWidth: '140px', height: 'auto' }} 
                        className="trial-logo"
                    />
                    <div className="logo-fallback" style={{ display: 'none', width: '60px', height: '60px', border: '4px solid #000', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontWeight: 900, fontSize: '2rem' }}>I</span>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
                {step === 'calendar' && (
                    <div className="fade-in">
                        <div className="banner-container">
                            <h1 className="banner-title">BOOK YOUR TRIAL</h1>
                            <p className="banner-subtitle" style={{ color: '#000' }}>
                                Select a time slot that works for you. Your first step towards a limitless version of yourself begins here.
                            </p>
                        </div>

                        <div style={{ background: '#fff', border: '4px solid #000', padding: '0', borderRadius: '8px', overflow: 'hidden' }}>
                            <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '2px solid #000' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase' }}>SELECT A TIME</h3>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => {
                                                const d = new Date(currentWeekStart);
                                                d.setDate(d.getDate() - daysToShow);
                                                setCurrentWeekStart(d);
                                            }}
                                            style={{ padding: '8px', background: 'transparent', border: '2px solid #000', cursor: 'pointer', color: '#000', borderRadius: '6px' }}
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const d = new Date(currentWeekStart);
                                                d.setDate(d.getDate() + daysToShow);
                                                setCurrentWeekStart(d);
                                            }}
                                            style={{ padding: '8px', background: 'transparent', border: '2px solid #000', cursor: 'pointer', color: '#000', borderRadius: '6px' }}
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '12px', height: '12px', background: '#000' }}></div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>AVAILABLE</span>
                                </div>
                            </div>

                            <div style={{ overflowX: 'hidden' }}>
                                <div style={{ 
                                    width: '100%', 
                                    display: 'grid', 
                                    gridTemplateColumns: `${isMobile ? '60px' : '80px'} repeat(${daysToShow}, 1fr)` 
                                }}>
                                    <div style={{ borderRight: '1px solid #000' }}></div>
                                    {DAYS.slice(0, daysToShow).map((day, i) => {
                                        const date = new Date(currentWeekStart);
                                        date.setDate(date.getDate() + i);
                                        const isToday = date.toDateString() === new Date().toDateString();
                                        return (
                                            <div key={day} style={{ padding: isMobile ? '8px 4px' : '16px', borderRight: '1px solid #000', textAlign: 'center', background: isToday ? '#f0f0f0' : 'transparent' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#000', textTransform: 'uppercase' }}>{day}</div>
                                                <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 900 }}>{date.getDate()}</div>
                                            </div>
                                        );
                                    })}

                                    {TIME_SLOTS.map(time => (
                                        <React.Fragment key={time}>
                                            <div style={{ padding: isMobile ? '12px 4px' : '20px', fontSize: '0.75rem', fontWeight: 900, borderTop: '1px solid #000', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                                const availableTrainers = gridAvailability[`${i}-${time}`] || [];
                                                const isAvailable = availableTrainers.length > 0 && !isPast;

                                                return (
                                                    <div 
                                                        key={`${i}-${time}`}
                                                        onClick={() => isAvailable && handleSlotClick(date, time, availableTrainers)}
                                                        style={{ 
                                                            minHeight: '80px', 
                                                            borderTop: '1px solid #000', 
                                                            borderRight: '1px solid #000',
                                                            background: isAvailable ? '#fff' : '#f9f9f9',
                                                            cursor: isAvailable ? 'pointer' : 'default',
                                                            padding: '4px',
                                                            transition: 'all 0.2s',
                                                            position: 'relative',
                                                            opacity: isPast ? 0.3 : 1,
                                                            pointerEvents: isPast ? 'none' : 'auto'
                                                        }}
                                                        className={isAvailable ? 'calendar-cell available' : 'calendar-cell'}
                                                    >
                                                        {isAvailable && (
                                                            <div className="book-btn" style={{ height: '100%', border: 'none', background: '#000', color: '#fff', display: 'none', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, borderRadius: '6px' }}>
                                                                BOOK
                                                            </div>
                                                        )}
                                                        {!isAvailable && isPast && (
                                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>
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
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
                        <div className="fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', background: '#fff', border: '4px solid #000', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                    <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px', textTransform: 'uppercase' }}>BOOKING TRIAL</h1>
                                    <p style={{ fontWeight: 900, background: '#000', color: '#fff', display: 'inline-block', padding: '4px 12px', fontSize: '0.9rem', textTransform: 'uppercase', borderRadius: 0 }}>
                                        {DAYS[selectedSlot.day]} {selectedSlot.date.getDate()} @ {selectedSlot.time}
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {error && (
                                        <div style={{ padding: '12px', background: 'transparent', border: '2px solid #ff4444', color: '#ff4444', fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: 0 }}>
                                            <AlertCircle size={16} />
                                            <span style={{ textTransform: 'uppercase' }}>{error}</span>
                                        </div>
                                    )}

                                    <div>
                                        <label style={{ display: 'block', fontWeight: 900, fontSize: '0.75rem', marginBottom: '12px', color: '#000', textTransform: 'uppercase' }}>1. Choose Trainer</label>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '12px', top: '14px', color: '#000' }}><User size={18} /></div>
                                            <select
                                                required
                                                value={formData.trainerId}
                                                onChange={e => setFormData({...formData, trainerId: e.target.value})}
                                                className="brutalist-input"
                                                style={{ 
                                                    width: '100%', 
                                                    padding: '12px 12px 12px 40px', 
                                                    border: '2px solid #000',
                                                    borderRadius: '6px', 
                                                    fontSize: '1rem', 
                                                    fontWeight: 900,
                                                    appearance: 'none',
                                                    background: '#fff',
                                                    color: '#000',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="" style={{ background: '#fff', color: '#000' }}>SELECT TRAINER...</option>
                                                {selectedSlot.availableTrainers.map(t => (
                                                    <option key={t.id} value={t.id} style={{ background: '#fff', color: '#000' }}>{t.name.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '10px' }}>
                                        <label style={{ display: 'block', fontWeight: 900, fontSize: '0.75rem', marginBottom: '24px', color: '#000', textTransform: 'uppercase' }}>2. Your Details</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontWeight: 900, fontSize: '0.65rem', color: '#000', textTransform: 'uppercase', marginBottom: '4px' }}>Name</label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    value={formData.name}
                                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                                    className="brutalist-input"
                                                    style={{ width: '100%', padding: '12px', border: '2px solid #000', background: '#fff', color: '#000', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}
                                                    placeholder="FULL NAME" 
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontWeight: 900, fontSize: '0.65rem', color: '#000', textTransform: 'uppercase', marginBottom: '4px' }}>Email</label>
                                                <input 
                                                    type="email" 
                                                    required
                                                    value={formData.email}
                                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                                    className="brutalist-input"
                                                    style={{ width: '100%', padding: '12px', border: '2px solid #000', background: '#fff', color: '#000', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}
                                                    placeholder="EMAIL@EXAMPLE.COM" 
                                                />
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontWeight: 900, fontSize: '0.65rem', color: '#000', textTransform: 'uppercase', marginBottom: '4px' }}>Phone</label>
                                                    <input 
                                                        type="tel" 
                                                        required
                                                        value={formData.phone}
                                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                                        className="brutalist-input"
                                                        style={{ width: '100%', padding: '12px', border: '2px solid #000', background: '#fff', color: '#000', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}
                                                        placeholder="+91 XXXX" 
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontWeight: 900, fontSize: '0.65rem', color: '#000', textTransform: 'uppercase', marginBottom: '4px' }}>Password</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input 
                                                            type={showPassword ? "text" : "password"} 
                                                            required
                                                            value={formData.password}
                                                            onChange={e => setFormData({...formData, password: e.target.value})}
                                                            className="brutalist-input"
                                                            style={{ width: '100%', padding: '12px 48px 12px 12px', border: '2px solid #000', background: '#fff', color: '#000', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}
                                                            placeholder="••••••••" 
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            style={{ 
                                                                position: 'absolute', 
                                                                right: '12px', 
                                                                top: '50%', 
                                                                transform: 'translateY(-50%)',
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: '#000',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '4px'
                                                            }}
                                                        >
                                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                        </button>
                                                    </div>
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
                                            background: '#000', 
                                            color: '#fff', 
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
                                    <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#000', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginTop: '10px', width: '100%' }}>CANCEL</button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'success' && (
                    <div className="fade-in" style={{ textAlign: 'center', maxWidth: '600px', margin: '100px auto' }}>
                        <div style={{ marginBottom: '32px' }}>
                            <CheckCircle2 size={80} color="#000" style={{ margin: '0 auto' }} />
                        </div>
                        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '16px', textTransform: 'uppercase' }}>You are locked in!</h1>
                        <p style={{ fontSize: '1.2rem', color: '#000', fontWeight: 600, marginBottom: '40px', textTransform: 'uppercase' }}>
                            Check your WhatsApp for confirmation. We will call you shortly.
                        </p>
                        <button 
                            onClick={() => navigate('/login')}
                            style={{ padding: '20px 40px', background: '#000', color: '#fff', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: '6px' }}
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
                    background: #f5f5f5 !important;
                }
                
                .calendar-cell.available:hover .book-btn {
                    display: flex !important;
                }

                .brutalist-input:focus {
                    outline: 2px solid #000 !important;
                    background: #fff !important;
                }

                ::placeholder {
                    color: #999;
                    opacity: 1;
                }

                select::-ms-expand {
                    display: none;
                }
                
                * {
                    -webkit-tap-highlight-color: transparent;
                }

                .trial-header {
                    padding: 24px 16px;
                    background: #fff;
                    border-bottom: 2px solid #000;
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
                    color: #000;
                }

                .banner-subtitle {
                    font-size: 1.1rem;
                    font-weight: 600;
                    max-width: 600px;
                    margin: 0 auto;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

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
