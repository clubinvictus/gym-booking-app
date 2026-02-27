import { useState, useEffect } from 'react';
import { X, Clock, User, Briefcase, Calendar as CalendarIcon } from 'lucide-react';
import { db } from '../firebase';
import { addDoc, collection, doc, updateDoc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { SITE_ID } from '../constants';
import { useFirestore } from '../hooks/useFirestore';

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedSlot: { day: number; time: string; date?: Date; trainerId?: string | null } | null;
    editingSession?: any;
    excludedTrainerId?: string | null;
    onBook: (data: any) => void;
}

const timeSlots = [
    '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM',
    '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM'
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const daysMap: { [key: number]: string } = {
    0: 'monday', 1: 'tuesday', 2: 'wednesday', 3: 'thursday', 4: 'friday', 5: 'saturday', 6: 'sunday'
};

export const BookingModal = ({ isOpen, onClose, selectedSlot, editingSession, excludedTrainerId, onBook }: BookingModalProps) => {
    const { data: clients } = useFirestore<any>('clients');
    const { data: trainers } = useFirestore<any>('trainers');
    const { data: services } = useFirestore<any>('services');
    const { data: offDays } = useFirestore<any>('off_days');

    const [selectedClient, setSelectedClient] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [selectedTrainer, setSelectedTrainer] = useState('');
    const [selectedService, setSelectedService] = useState('');
    const [selectedTime, setSelectedTime] = useState('09:00 AM');
    const [selectedDay, setSelectedDay] = useState(0);
    const [isRepeating, setIsRepeating] = useState(false);
    const [repeatFrequency, setRepeatFrequency] = useState<'daily' | 'weekly'>('weekly');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [repeatUntil, setRepeatUntil] = useState('');
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
    const isClient = profile?.role === 'client';
    const limitDays = isAdmin ? 730 : 14;
    const [repeatEndType, setRepeatEndType] = useState<'never' | 'on_date'>('on_date');
    const [editMode, setEditMode] = useState<'single' | 'future'>('single');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate the maximum client booking date (14 days from now)
    const getClientMaxDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d;
    };

    useEffect(() => {
        if (editingSession) {
            setSelectedClient(editingSession.clientName);
            setSelectedTrainer(editingSession.trainerName);
            setSelectedService(editingSession.serviceName);
            setSelectedTime(editingSession.time);
            setSelectedDay(editingSession.day);
            setSelectedDays([editingSession.day]);
        } else if (selectedSlot) {
            setSelectedTime(selectedSlot.time);
            setSelectedDay(selectedSlot.day);
            setSelectedDays([selectedSlot.day]);

            // If user is a client, default the clientName to their profile name
            if (isClient && profile?.name) {
                setSelectedClient(profile.name);
            }
            const initialTrainer = selectedSlot?.trainerId
                ? (trainers.find(t => t.id === selectedSlot.trainerId)?.name || '')
                : '';
            setSelectedTrainer(initialTrainer);
        }
    }, [editingSession, selectedSlot, trainers]);


    const toggleDay = (dayIdx: number) => {
        setSelectedDays(prev =>
            prev.includes(dayIdx)
                ? prev.filter(d => d !== dayIdx)
                : [...prev, dayIdx].sort()
        );
    };

    const convertTo24h = (timeStr: string) => {
        if (!timeStr) return '';
        if (timeStr.includes(':') && timeStr.length === 5) return timeStr;

        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = (parseInt(hours, 10) + 12).toString().padStart(2, '0');
        else hours = hours.padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const getTargetDateForDayIndex = (dayIdx: number) => {
        const baseDate = editingSession?.date
            ? new Date(editingSession.date)
            : (selectedSlot?.date ? new Date(selectedSlot.date) : new Date());

        const currentDay = baseDate.getDay();
        const targetDay = (dayIdx + 1) % 7;
        const diff = targetDay - currentDay;
        baseDate.setDate(baseDate.getDate() + (diff < 0 ? diff + 7 : diff));
        return baseDate;
    };

    const isAvailable = (trainer: any) => {
        const dayName = daysMap[selectedDay];
        const daySchedule = trainer.availability?.[dayName];
        if (!daySchedule || !daySchedule.active) return false;

        // Check for persistent off-day
        const targetDate = getTargetDateForDayIndex(selectedDay);
        const dateStr = targetDate.toISOString().split('T')[0];
        const isOff = offDays.some((od: any) => od.trainerId === trainer.id && od.date === dateStr);
        if (isOff) return false;

        const slotTime = convertTo24h(selectedTime);

        // Support both old format (start/end) and new format (shifts array)
        if (daySchedule.shifts) {
            return daySchedule.shifts.some((shift: { start: string, end: string }) => {
                const startTime = convertTo24h(shift.start);
                const endTime = convertTo24h(shift.end);
                return slotTime >= startTime && slotTime < endTime;
            });
        } else if (daySchedule.start && daySchedule.end) {
            const startTime = convertTo24h(daySchedule.start);
            const endTime = convertTo24h(daySchedule.end);
            return slotTime >= startTime && slotTime < endTime;
        }

        return false;
    };

    const availableTrainers = trainers.filter(t =>
        (selectedService ? (t.specialties?.includes(selectedService)) : true) &&
        isAvailable(t) &&
        (excludedTrainerId ? t.id !== excludedTrainerId : true)
    );

    useEffect(() => {
        if (selectedTrainer && !availableTrainers.find(t => t.name === selectedTrainer)) {
            setSelectedTrainer('');
        }
    }, [selectedService, selectedDay, selectedTime, availableTrainers, selectedTrainer]);

    if (!isOpen || !selectedSlot) return null;

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        if (!isClient && !clients.some((c: any) => c.name === selectedClient)) {
            alert('Please select a valid client from the list.');
            setIsSubmitting(false);
            return;
        }

        const baseDate = editingSession?.date
            ? new Date(editingSession.date)
            : (selectedSlot?.date ? new Date(selectedSlot.date) : new Date());

        const getBookingData = (date: Date, dayIdx: number) => {
            const client = clients.find(c => c.name === selectedClient);
            const trainer = trainers.find(t => t.name === selectedTrainer);
            const service = services.find(s => s.name === (selectedService || editingSession?.serviceName));

            return {
                clientName: isClient ? profile?.name : (selectedClient || editingSession?.clientName),
                clientId: isClient ? profile?.uid : (client?.id || null),
                trainerName: selectedTrainer,
                trainerId: trainer?.id || null,
                serviceName: selectedService || editingSession?.serviceName,
                serviceId: service?.id || null,
                time: selectedTime,
                day: dayIdx,
                date: date.toISOString(),
                status: 'Scheduled',
                siteId: SITE_ID,
                createdAt: new Date().toISOString()
            };
        };

        const logActivity = async (action: 'booked' | 'rescheduled', sessionDetails: any) => {
            try {
                await addDoc(collection(db, 'activity_logs'), {
                    action,
                    sessionDetails: {
                        clientName: sessionDetails.clientName,
                        trainerName: sessionDetails.trainerName,
                        serviceName: sessionDetails.serviceName,
                        date: sessionDetails.date,
                        time: sessionDetails.time
                    },
                    performedBy: {
                        uid: profile?.uid || 'unknown',
                        name: profile?.name || 'Unknown User',
                        role: profile?.role || 'unknown'
                    },
                    timestamp: new Date().toISOString(),
                    siteId: SITE_ID
                });
            } catch (err) {
                console.error('Failed to log activity:', err);
            }
        };

        try {
            if (editingSession) {
                // Adjust baseDate to match possibly changed selectedDay
                const currentDay = baseDate.getDay();
                const targetDay = (selectedDay + 1) % 7;
                const diff = targetDay - currentDay;
                baseDate.setDate(baseDate.getDate() + (diff < 0 ? diff + 7 : diff));

                if (editMode === 'future' && editingSession.seriesId) {
                    const batch = writeBatch(db);
                    // Query for all future sessions in this series
                    const querySnapshot = await getDocs(
                        query(
                            collection(db, 'sessions'),
                            where('seriesId', '==', editingSession.seriesId),
                            where('date', '>=', editingSession.date)
                        )
                    );

                    querySnapshot.forEach((docSnap) => {
                        const sessData = docSnap.data();
                        const sessDate = new Date(sessData.date);

                        // Maintain the same time but update other fields if they changed
                        // NOTE: If day changed, we'd need more complex logic to shift the whole series.
                        // For now, let's update common fields.
                        batch.update(doc(db, 'sessions', docSnap.id), {
                            trainerName: selectedTrainer,
                            serviceName: selectedService || editingSession?.serviceName,
                            time: selectedTime,
                            // Ensure day matches the date's day of week
                            day: sessDate.getDay() === 0 ? 6 : sessDate.getDay() - 1
                        });
                    });
                    await batch.commit();
                    await logActivity('rescheduled', getBookingData(baseDate, selectedDay));
                } else {
                    const updatedData = getBookingData(baseDate, selectedDay);
                    await updateDoc(doc(db, 'sessions', editingSession.id), updatedData);
                    await logActivity('rescheduled', updatedData);
                }
            } else if (isRepeating) {
                const seriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // If "Never", set endDate to 2 years from now (admin only)
                // If client, force end date to max 14 days
                const endDate = isClient
                    ? getClientMaxDate()
                    : (repeatEndType === 'never'
                        ? new Date(new Date().getFullYear() + 2, new Date().getMonth(), new Date().getDate())
                        : new Date(repeatUntil));

                const getSeriesData = (date: Date, dayIdx: number) => ({
                    ...getBookingData(date, dayIdx),
                    seriesId
                });

                let sessionBatch = writeBatch(db);
                let opCount = 0;

                const commitIfFull = async () => {
                    if (opCount >= 450) { // Safety margin
                        await sessionBatch.commit();
                        sessionBatch = writeBatch(db);
                        opCount = 0;
                    }
                };

                if (repeatFrequency === 'daily') {
                    let currentDate = new Date(baseDate);

                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    if (currentDate < todayStart) {
                        currentDate = new Date(todayStart);
                    }

                    while (currentDate <= endDate) {
                        const sessDay = (currentDate.getDay() + 6) % 7;
                        sessionBatch.set(doc(collection(db, 'sessions')), getSeriesData(new Date(currentDate), sessDay));
                        opCount++;
                        await commitIfFull();
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                } else {
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);

                    for (const dayIdx of selectedDays) {
                        let currentDate = new Date(baseDate);
                        const currentDay = currentDate.getDay();
                        const targetDay = (dayIdx + 1) % 7;
                        let diff = targetDay - currentDay;
                        if (diff < 0) diff += 7;
                        currentDate.setDate(currentDate.getDate() + diff);

                        // Ensure recurring series starts on or after today
                        if (currentDate < todayStart) {
                            currentDate.setDate(currentDate.getDate() + 7);
                        }

                        while (currentDate <= endDate) {
                            sessionBatch.set(doc(collection(db, 'sessions')), getSeriesData(new Date(currentDate), dayIdx));
                            opCount++;
                            await commitIfFull();
                            currentDate.setDate(currentDate.getDate() + 7);
                        }
                    }
                }
                if (opCount > 0) await sessionBatch.commit();
                await logActivity('booked', getBookingData(baseDate, selectedDay));
            } else {
                // Single booking
                const currentDay = baseDate.getDay();
                const targetDay = (selectedDay + 1) % 7;
                const diff = targetDay - currentDay;
                baseDate.setDate(baseDate.getDate() + (diff < 0 ? diff + 7 : diff));
                await addDoc(collection(db, 'sessions'), getBookingData(baseDate, selectedDay));
            }
            onBook({});
            onClose();
        } catch (error) {
            console.error('Error saving session:', error);
            alert('Failed to save session.');
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="card" style={{
                width: '95%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: 'min(32px, 5vw)',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'sticky',
                        top: '0',
                        alignSelf: 'flex-end',
                        background: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        zIndex: 10,
                        padding: '8px',
                        marginTop: '-12px',
                        marginRight: '-12px'
                    }}
                >
                    <X size={24} />
                </button>

                <div style={{ paddingBottom: '20px' }}>
                    <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', marginBottom: '8px' }}>{editingSession ? 'Edit Session' : 'Book Session'}</h2>
                    <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.9rem' }}>{editingSession ? 'Update booking details' : 'Schedule a new visit to Invictus'}</p>

                    <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {editingSession?.seriesId && (
                            <div style={{ padding: '16px', background: '#f5f5f5', border: '2px solid #000', marginBottom: '8px' }}>
                                <label style={{ display: 'block', fontWeight: 800, marginBottom: '12px', fontSize: '0.8rem', color: '#666' }}>EDITING RECURRING SERIES</label>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="editMode"
                                            value="single"
                                            checked={editMode === 'single'}
                                            onChange={() => setEditMode('single')}
                                            style={{ width: '18px', height: '18px' }}
                                        /> Just this event
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="editMode"
                                            value="future"
                                            checked={editMode === 'future'}
                                            onChange={() => setEditMode('future')}
                                            style={{ width: '18px', height: '18px' }}
                                        /> This and future
                                    </label>
                                </div>
                            </div>
                        )}

                        {!isClient && (
                            <div>
                                <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>CLIENT</label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '16px', top: '14px' }}><User size={18} className="text-muted" /></div>
                                    <input
                                        type="text"
                                        name="clientName"
                                        required={!isClient}
                                        placeholder="Search for a client"
                                        value={selectedClient}
                                        onChange={(e) => {
                                            setSelectedClient(e.target.value);
                                            setShowClientDropdown(true);
                                        }}
                                        onFocus={() => setShowClientDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 48px',
                                            borderRadius: 0,
                                            border: '2px solid #000',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            backgroundColor: '#fff'
                                        }}
                                        autoComplete="off"
                                    />
                                    {showClientDropdown && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            background: '#fff',
                                            border: '2px solid #000',
                                            borderTop: 'none',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            zIndex: 20,
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                        }}>
                                            {clients.filter((c: any) => c.name.toLowerCase().includes(selectedClient.toLowerCase())).length > 0 ? (
                                                clients.filter((c: any) => c.name.toLowerCase().includes(selectedClient.toLowerCase())).map((c: any) => (
                                                    <div
                                                        key={c.id}
                                                        onClick={() => {
                                                            setSelectedClient(c.name);
                                                            setShowClientDropdown(false);
                                                        }}
                                                        style={{
                                                            padding: '12px 16px',
                                                            cursor: 'pointer',
                                                            borderBottom: '1px solid #111',
                                                            fontWeight: 600
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                                    >
                                                        {c.name}
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '12px 16px', color: '#666', fontStyle: 'italic', fontWeight: 600 }}>No clients found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>SERVICE</label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '16px', top: '14px' }}><CalendarIcon size={18} className="text-muted" /></div>
                                <select
                                    name="serviceName"
                                    required
                                    value={selectedService}
                                    onChange={(e) => setSelectedService(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 48px',
                                        borderRadius: 0,
                                        border: '2px solid #000',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        appearance: 'none',
                                        backgroundColor: '#fff'
                                    }}
                                >
                                    <option value="">Select service</option>
                                    {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>{isRepeating && repeatFrequency === 'weekly' ? 'START DAY' : 'DAY'}</label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '16px', top: '14px' }}><CalendarIcon size={18} className="text-muted" /></div>
                                    <select
                                        name="day"
                                        value={selectedDay}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setSelectedDay(val);
                                            if (!isRepeating || repeatFrequency !== 'weekly') {
                                                setSelectedDays([val]);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 48px',
                                            borderRadius: 0,
                                            border: '2px solid #000',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            appearance: 'none',
                                            backgroundColor: '#fff'
                                        }}
                                    >
                                        {days.map((day, i) => {
                                            const targetDate = getTargetDateForDayIndex(i);
                                            const dateStr = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                            return (
                                                <option key={day} value={i}>{day} ({dateStr})</option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>TIME</label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '16px', top: '14px' }}><Clock size={18} className="text-muted" /></div>
                                    <select
                                        name="time"
                                        value={selectedTime}
                                        onChange={(e) => setSelectedTime(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 48px',
                                            borderRadius: 0,
                                            border: '2px solid #000',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            appearance: 'none',
                                            backgroundColor: '#fff'
                                        }}
                                    >
                                        {timeSlots.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>TRAINER</label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '16px', top: '14px' }}><Briefcase size={18} className="text-muted" /></div>
                                <select
                                    name="trainerName"
                                    required
                                    value={selectedTrainer}
                                    onChange={(e) => setSelectedTrainer(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 48px',
                                        borderRadius: 0,
                                        border: '2px solid #000',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        appearance: 'none',
                                        backgroundColor: availableTrainers.length === 0 ? '#fff5f5' : '#fff'
                                    }}
                                >
                                    <option value="">Select trainer</option>
                                    {availableTrainers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                </select>
                            </div>
                            {availableTrainers.length === 0 && (
                                <div style={{
                                    padding: '16px',
                                    background: '#fff5f5',
                                    border: '2px solid #ff4444',
                                    marginTop: '8px'
                                }}>
                                    <p style={{ fontSize: '0.85rem', color: '#ff4444', fontWeight: 800, margin: 0 }}>
                                        No trainers available for this service at the selected time.
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: '#ff4444', fontWeight: 600, marginTop: '4px' }}>
                                        Please try a different time slot or day from the options above.
                                    </p>
                                </div>
                            )}
                        </div>

                        {!editingSession && (
                            <div>
                                <label style={{ display: 'block', fontWeight: 800, marginBottom: '12px', fontSize: '0.9rem' }}>RECURRENCE</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '2px solid #000' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={isRepeating}
                                            onChange={(e) => {
                                                setIsRepeating(e.target.checked);
                                                if (e.target.checked && selectedDays.length === 0) {
                                                    setSelectedDays([selectedDay]);
                                                }
                                            }}
                                            style={{ width: '20px', height: '20px', border: '3px solid #000', borderRadius: 0 }}
                                        />
                                        REPEAT BOOKING
                                    </label>

                                    {isRepeating && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {isAdmin ? (
                                                    // Admin/Manager View
                                                    <>
                                                        <div style={{ display: 'flex', gap: '12px' }}>
                                                            <select
                                                                value={repeatFrequency}
                                                                onChange={(e) => setRepeatFrequency(e.target.value as 'daily' | 'weekly')}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '8px',
                                                                    border: '2px solid #000',
                                                                    fontWeight: 700,
                                                                    borderRadius: 0,
                                                                    fontSize: '0.9rem'
                                                                }}
                                                            >
                                                                <option value="daily">Daily</option>
                                                                <option value="weekly">Weekly</option>
                                                            </select>
                                                            <select
                                                                value={repeatEndType}
                                                                onChange={(e) => setRepeatEndType(e.target.value as 'never' | 'on_date')}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '8px',
                                                                    border: '2px solid #000',
                                                                    fontWeight: 700,
                                                                    borderRadius: 0,
                                                                    fontSize: '0.9rem'
                                                                }}
                                                            >
                                                                <option value="never">Never ends</option>
                                                                <option value="on_date">Ends on date</option>
                                                            </select>
                                                        </div>

                                                        {repeatEndType === 'on_date' && (
                                                            <input
                                                                type="date"
                                                                required={isRepeating && repeatEndType === 'on_date'}
                                                                value={repeatUntil}
                                                                onChange={(e) => setRepeatUntil(e.target.value)}
                                                                min={new Date().toISOString().split('T')[0]}
                                                                max={new Date(new Date().getTime() + limitDays * 86400000).toISOString().split('T')[0]}
                                                                style={{
                                                                    padding: '8px',
                                                                    border: '2px solid #000',
                                                                    fontWeight: 700,
                                                                    borderRadius: 0,
                                                                    fontSize: '0.85rem'
                                                                }}
                                                            />
                                                        )}
                                                    </>
                                                ) : (
                                                    // Client View
                                                    <div style={{ background: '#fff5f5', padding: '12px', border: '1px solid #ffcccc' }}>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#cc0000' }}>
                                                            Recurring bookings are limited to 2 weeks in advance. This series will end on <strong style={{ color: '#000' }}>{getClientMaxDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {repeatFrequency === 'weekly' && (
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    {days.map((day, i) => (
                                                        <button
                                                            key={day}
                                                            type="button"
                                                            onClick={() => toggleDay(i)}
                                                            style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '50%',
                                                                border: '2px solid #000',
                                                                background: selectedDays.includes(i) ? '#000' : '#fff',
                                                                color: selectedDays.includes(i) ? '#fff' : '#000',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            {day.charAt(0)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="button-primary"
                            disabled={(availableTrainers.length === 0 && !editingSession) || isSubmitting}
                            style={{
                                width: '100%',
                                padding: '16px',
                                marginTop: '12px',
                                position: 'sticky',
                                bottom: '0',
                                boxShadow: '0 -10px 10px #fff',
                                opacity: ((availableTrainers.length === 0 && !editingSession) || isSubmitting) ? 0.5 : 1,
                                cursor: isSubmitting ? 'wait' : 'pointer'
                            }}
                        >
                            {isSubmitting ? 'Processing...' : `Confirm ${editingSession ? 'Changes' : 'Booking'}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
