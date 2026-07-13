import React, { useState, useEffect } from 'react';
import {
    User,
    ChevronLeft,
    CheckCircle2,
    AlertCircle,
    Eye,
    EyeOff
} from 'lucide-react';
import { db } from './firebase';
import { collection, getDocs, query, where, onSnapshot, QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { SITE_ID } from './constants';
import { submitTrialBooking } from './utils/trialBooking';
import { isDateCoveredByRule } from './hooks/useActiveRecurringRules';
import type { RecurringRule } from './hooks/useActiveRecurringRules';
import { useNavigate } from 'react-router-dom';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const TIME_SLOTS = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00'
];
// How many days ahead the date strip offers — a trial is a one-off session, not a standing
// commitment, so there's no need to browse further than this.
const VISIBLE_DAYS = 14;

// Zero-padded to match the format sessions/recurring_series store the time in elsewhere in the
// app (BookingModal's TIME_SLOTS, e.g. "09:00 AM") — this value isn't just for display, it's also
// compared directly against rule.time in isDateCoveredByRule below, so the formats must match
// exactly.
const to12HourTime = (time24: string) => {
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

export const TrialBookingPage = () => {
    const [step, setStep] = useState<'calendar' | 'success'>('calendar');
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
    const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);

    // The date strip is a fixed rolling window computed once when the page loads — it doesn't
    // need to be navigable/paginated since it already shows everything relevant to a trial booking.
    const [rangeStart] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });

    // Selection state: date -> time (deduped across trainers) -> trainer (skipped automatically
    // if only one trainer is available at that time) -> booking form.
    const [selectedDate, setSelectedDate] = useState(rangeStart);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<{ date: Date, time: string, day: number, trainer: { id: string, name: string } } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: ''
    });

    const navigate = useNavigate();

    // 1. One-time fetch: trial service + assigned trainers (small, doesn't change per page-view).
    useEffect(() => {
        const fetchData = async () => {
            try {
                const qService = query(
                    collection(db, 'services'),
                    where('siteId', '==', SITE_ID),
                    where('allowed_tiers', 'array-contains', 'lead')
                );
                const serviceSnap = await getDocs(qService);

                if (serviceSnap.empty) {
                    setError('Trial service not configured for this site.');
                    return;
                }

                const s = { id: serviceSnap.docs[0].id, ...(serviceSnap.docs[0].data() as any) };
                setTrialService(s);

                const trainerIds = s.assigned_trainer_ids || [];
                if (trainerIds.length === 0) {
                    setError('No trainers assigned to the Trial service.');
                    return;
                }

                const trainersSnap = await getDocs(query(collection(db, 'trainers'), where('__name__', 'in', trainerIds.slice(0, 10))));
                setTrainers(trainersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err: any) {
                console.error('Fetch error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // 2. Availability data, scoped to the fixed VISIBLE_DAYS window — these were previously
    // unbounded, whole-collection listeners (every session and every busy-slot ever created,
    // site-wide), which is exactly the pattern already diagnosed and fixed on the main app's
    // calendar: a public, anonymous page pulling down thousands of documents and re-scanning all
    // of them per rendered slot on every render is precisely what produces a long-blocking main
    // thread and Chrome's "Page Unresponsive".
    useEffect(() => {
        const rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + VISIBLE_DAYS - 1);
        rangeEnd.setHours(23, 59, 59, 999);
        const rangeStartDateOnly = rangeStart.toISOString().split('T')[0];
        const rangeEndDateOnly = rangeEnd.toISOString().split('T')[0];

        const unsubSessions = onSnapshot(
            query(
                collection(db, 'sessions'),
                where('siteId', '==', SITE_ID),
                where('date', '>=', rangeStart.toISOString()),
                where('date', '<=', rangeEnd.toISOString())
            ),
            (snap: QuerySnapshot<DocumentData>) => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        const unsubOffDays = onSnapshot(
            query(
                collection(db, 'off_days'),
                where('siteId', '==', SITE_ID),
                where('date', '>=', rangeStartDateOnly),
                where('date', '<=', rangeEndDateOnly)
            ),
            (snap: QuerySnapshot<DocumentData>) => setOffDays(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        const unsubBusySlots = onSnapshot(
            query(
                collection(db, 'trainer_busy_slots'),
                where('siteId', '==', SITE_ID),
                where('date', '>=', rangeStart.toISOString()),
                where('date', '<=', rangeEnd.toISOString())
            ),
            (snap: QuerySnapshot<DocumentData>) => setBusySlots(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        return () => {
            unsubSessions();
            unsubOffDays();
            unsubBusySlots();
        };
    }, [rangeStart]);

    // 3. Active recurring_series rules — a rule can commit a slot arbitrarily far in the future
    // (it may run indefinitely) beyond what's materialized into busySlots yet, but active-rule
    // count for the whole site is small (bounded by ongoing commitments), so this doesn't need
    // date-scoping the way the collections above do.
    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'recurring_series'), where('siteId', '==', SITE_ID), where('status', '==', 'active')),
            (snap: QuerySnapshot<DocumentData>) => setRecurringRules(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringRule)))
        );
        return () => unsub();
    }, []);

    // Which trainers (if any) are free for this exact date + time.
    const getSlotAvailability = (date: Date, time: string) => {
        if (!trialService) return [];

        const dateStr = date.toISOString().split('T')[0];
        const dateISO = date.toISOString();
        const time12 = to12HourTime(time);
        const available: any[] = [];

        for (const trainer of trainers) {
            const isOff = offDays.some(od => od.trainerId === trainer.id && od.date === dateStr);
            if (isOff) continue;

            const existingSessions = sessions.filter(s => {
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

            let hasConflict = false;
            if (existingSessions.length > 0) {
                const session = existingSessions[0];
                const maxCap = trialService.max_capacity || 1;
                const currentCount = session.clients?.length || 1;

                // Reject if full, or if the existing session is a different service type
                if (currentCount >= maxCap || session.serviceId !== trialService.id) {
                    hasConflict = true;
                }
            }
            if (hasConflict) continue;

            const isBusy = busySlots.some(bs => bs.trainerId === trainer.id && bs.time === time && bs.date === dateISO);
            if (isBusy) continue;

            // Beyond the materialized busySlots window, a recurring_series rule can still
            // commit this slot arbitrarily far in the future (a rule may run indefinitely).
            if (isDateCoveredByRule(recurringRules, trainer.id, dateStr, time12)) continue;

            available.push({ id: trainer.id, name: trainer.name });
        }
        return available;
    };

    const dateStripDays = Array.from({ length: VISIBLE_DAYS }, (_, i) => {
        const d = new Date(rangeStart);
        d.setDate(d.getDate() + i);
        return d;
    });

    // Deduped by time — one row per time slot, not one per (time, trainer) combination. Only
    // times with at least one available trainer are shown at all (no disabled/greyed rows).
    const timesForSelectedDate = TIME_SLOTS
        .map(time => {
            const [hours, minutes] = time.split(':').map(Number);
            const slotDateTime = new Date(selectedDate);
            slotDateTime.setHours(hours, minutes, 0, 0);
            const isPast = slotDateTime < new Date();
            const availableTrainers = isPast ? [] : getSlotAvailability(selectedDate, time);
            return { time, availableTrainers };
        })
        .filter(t => t.availableTrainers.length > 0);

    const trainersForSelectedTime = selectedTime
        ? timesForSelectedDate.find(t => t.time === selectedTime)?.availableTrainers || []
        : [];

    const openBookingModal = (date: Date, time: string, trainer: { id: string, name: string }) => {
        setSelectedSlot({ date, time, day: (date.getDay() + 6) % 7, trainer });
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleTimeClick = (time: string, availableTrainers: any[]) => {
        if (availableTrainers.length === 1) {
            // Only one trainer free at this time — no point making the visitor pick.
            openBookingModal(selectedDate, time, availableTrainers[0]);
        } else {
            setSelectedTime(time);
        }
    };

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setSelectedTime(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlot || !trialService) return;

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
                    trainerId: selectedSlot.trainer.id,
                    trainerName: selectedSlot.trainer.name,
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

    const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
    const selectedDateLabel = `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selectedDate.getDay()]}, ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

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

            <main style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
                {step === 'calendar' && (
                    <div className="fade-in">
                        <div className="banner-container">
                            <h1 className="banner-title">BOOK YOUR TRIAL</h1>
                            <p className="banner-subtitle" style={{ color: '#000' }}>
                                Select a time slot that works for you. Your first step towards a limitless version of yourself begins here.
                            </p>
                        </div>

                        <div style={{ background: '#fff', border: '4px solid #000', padding: '20px', borderRadius: '12px' }}>
                            {/* Date strip */}
                            <div className="date-strip">
                                {dateStripDays.map(d => (
                                    <button
                                        key={d.toISOString()}
                                        type="button"
                                        className={`day-chip${d.toDateString() === selectedDate.toDateString() ? ' selected' : ''}${isToday(d) ? ' today' : ''}`}
                                        onClick={() => handleDateClick(d)}
                                    >
                                        <span className="dow">{DOW_SHORT[d.getDay()]}</span>
                                        <span className="num">{d.getDate()}</span>
                                    </button>
                                ))}
                            </div>

                            {selectedTime === null ? (
                                <>
                                    <p className="section-label">Available {selectedDateLabel}</p>
                                    {timesForSelectedDate.length === 0 ? (
                                        <p className="empty-note">No openings this day — try another date above.</p>
                                    ) : (
                                        <div className="time-list">
                                            {timesForSelectedDate.map(({ time, availableTrainers }) => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    className="time-row"
                                                    onClick={() => handleTimeClick(time, availableTrainers)}
                                                >
                                                    <span className="t">{to12HourTime(time)}</span>
                                                    <span className="go">SELECT →</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button type="button" className="back-link" onClick={() => setSelectedTime(null)}>
                                        <ChevronLeft size={16} /> Back to times
                                    </button>
                                    <p className="section-label">Available Trainers — {selectedDateLabel} at {to12HourTime(selectedTime)}</p>
                                    <div className="time-list">
                                        {trainersForSelectedTime.map((trainer: any) => (
                                            <button
                                                key={trainer.id}
                                                type="button"
                                                className="time-row"
                                                onClick={() => openBookingModal(selectedDate, selectedTime, trainer)}
                                            >
                                                <span className="t"><User size={15} style={{ marginRight: '8px', verticalAlign: '-3px' }} />{trainer.name}</span>
                                                <span className="go">SELECT →</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {isModalOpen && selectedSlot && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
                        <div className="fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', background: '#fff', border: '4px solid #000', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                    <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px', textTransform: 'uppercase' }}>BOOKING TRIAL</h1>
                                    <p style={{ fontWeight: 900, background: '#000', color: '#fff', display: 'inline-block', padding: '4px 12px', fontSize: '0.9rem', textTransform: 'uppercase', borderRadius: 0, marginBottom: '8px' }}>
                                        {DAYS[selectedSlot.day]} {selectedSlot.date.getDate()} @ {selectedSlot.time}
                                    </p>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#666' }}>
                                        with {selectedSlot.trainer.name}
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {error && (
                                        <div style={{ padding: '12px', background: 'transparent', border: '2px solid #ff4444', color: '#ff4444', fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: 0 }}>
                                            <AlertCircle size={16} />
                                            <span style={{ textTransform: 'uppercase' }}>{error}</span>
                                        </div>
                                    )}

                                    <div style={{ marginBottom: '10px' }}>
                                        <label style={{ display: 'block', fontWeight: 900, fontSize: '0.75rem', marginBottom: '24px', color: '#000', textTransform: 'uppercase' }}>Your Details</label>
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

                                            <div className="phone-password-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
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

                .brutalist-input:focus {
                    outline: 2px solid #000 !important;
                    background: #fff !important;
                }

                ::placeholder {
                    color: #999;
                    opacity: 1;
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
                    margin-bottom: 40px;
                    padding: 0 16px;
                }

                .banner-title {
                    font-size: 2.6rem;
                    font-weight: 900;
                    letter-spacing: -1.5px;
                    margin-bottom: 16px;
                    text-transform: uppercase;
                    line-height: 1;
                    color: #000;
                }

                .banner-subtitle {
                    font-size: 1rem;
                    font-weight: 600;
                    max-width: 460px;
                    margin: 0 auto;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                /* Date strip: horizontally scrollable, no pagination needed */
                .date-strip {
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    padding-bottom: 6px;
                    margin-bottom: 20px;
                    scrollbar-width: none;
                }
                .date-strip::-webkit-scrollbar { display: none; }

                .day-chip {
                    flex: 0 0 auto;
                    width: 54px;
                    padding: 10px 0 9px;
                    border: 2px solid #000;
                    border-radius: 12px;
                    text-align: center;
                    cursor: pointer;
                    background: transparent;
                    font-family: inherit;
                    color: #000;
                }
                .day-chip .dow { display: block; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.04em; opacity: .6; margin-bottom: 3px; }
                .day-chip .num { display: block; font-size: 1.05rem; font-weight: 900; }
                .day-chip.selected { background: #000; color: #fff; border-color: #000; }
                .day-chip.today:not(.selected) { border-color: #1fa251; }
                .day-chip:focus-visible { outline: 3px solid #1fa251; outline-offset: 2px; }

                .section-label {
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #666;
                    margin: 0 0 12px;
                }

                .empty-note {
                    font-size: 0.85rem;
                    color: #999;
                    text-align: center;
                    padding: 24px 0;
                }

                .time-list { display: flex; flex-direction: column; gap: 8px; }
                .time-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border: 2px solid #000;
                    border-radius: 10px;
                    padding: 14px 16px;
                    cursor: pointer;
                    background: transparent;
                    font-family: inherit;
                    color: #000;
                    width: 100%;
                    text-align: left;
                    transition: background .12s ease;
                }
                .time-row .t { font-size: 1rem; font-weight: 800; display: flex; align-items: center; }
                .time-row .go { font-size: 0.7rem; font-weight: 800; letter-spacing: .04em; color: #1fa251; opacity: 0; transition: opacity .12s ease; }
                .time-row:hover, .time-row:focus-visible { background: #eef9f0; border-color: #1fa251; outline: none; }
                .time-row:hover .go, .time-row:focus-visible .go { opacity: 1; }
                .time-row:active { background: #1fa251; }
                .time-row:active .t, .time-row:active .go { color: #fff; }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: none;
                    border: none;
                    font-family: inherit;
                    font-size: 0.78rem;
                    font-weight: 800;
                    letter-spacing: .03em;
                    text-transform: uppercase;
                    color: #000;
                    cursor: pointer;
                    padding: 0;
                    margin-bottom: 16px;
                }
                .back-link:hover { color: #1fa251; }

                select::-ms-expand {
                    display: none;
                }

                @media (max-width: 768px) {
                    .trial-header {
                        padding: 16px 16px;
                    }

                    .trial-logo {
                        max-width: 120px !important;
                    }

                    .banner-container {
                        margin-bottom: 32px;
                    }

                    .banner-title {
                        font-size: 2rem;
                        letter-spacing: -1px;
                    }

                    .banner-subtitle {
                        font-size: 0.85rem;
                        padding: 0 8px;
                    }
                }

                /* Phone/Password only need to stack on genuinely narrow phones (e.g. iPhone SE,
                   ~375px) — at tablet widths (up to 768px) there's room for both columns. */
                @media (max-width: 420px) {
                    .phone-password-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
};
