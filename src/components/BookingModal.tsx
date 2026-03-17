import { useState, useEffect } from 'react';
import { X, Clock, User, Briefcase, Calendar as CalendarIcon } from 'lucide-react';
import { db } from '../firebase';
import { addDoc, collection, doc, updateDoc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { SITE_ID } from '../constants';
import { useFirestore } from '../hooks/useFirestore';
import { useConfirm } from '../ConfirmContext';

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
    const confirm = useConfirm();
    const { user, profile } = useAuth();
    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
    const isClient = profile?.role === 'client';

    // The firestore rule for clients requires the email to match the auth token if not a manager.
    const clientConstraints = isClient && profile?.email ? [where('email', '==', profile.email)] : [];

    const { data: clients } = useFirestore<any>('clients', clientConstraints);
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

    const [editMode, setEditMode] = useState<'single' | 'future'>('single');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Conflict modal state
    const [conflictModal, setConflictModal] = useState<{
        conflicts: string[];
        conflictKeys: Set<string>;
        resolve: (skip: boolean) => void;
    } | null>(null);

    const showConflictModal = (conflicts: string[], conflictKeys: Set<string>): Promise<boolean> => {
        return new Promise((resolve) => {
            setConflictModal({ conflicts, conflictKeys, resolve });
        });
    };

    // Calculate the maximum client booking date (14 days from now)
    const getClientMaxDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d;
    };

    useEffect(() => {
        setIsSubmitting(false);
    }, [isOpen]);

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

            // Reset other fields for a fresh booking
            if (!isClient) {
                setSelectedClient('');
            } else if (profile?.name) {
                setSelectedClient(profile.name);
            }

            setSelectedService('');
            setIsRepeating(false);
            setRepeatFrequency('weekly');

            const initialTrainer = selectedSlot?.trainerId
                ? (trainers.find(t => t.id === selectedSlot.trainerId)?.name || '')
                : '';
            setSelectedTrainer(initialTrainer);
        }
    }, [editingSession, selectedSlot, trainers, isClient, profile]);


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

        // Block past bookings
        if (!editingSession) {
            const slotDate = selectedSlot?.date ? new Date(selectedSlot.date) : new Date();
            const [timePart, modifier] = selectedTime.split(' ');
            let [hours, minutes] = timePart.split(':').map(Number);
            if (modifier === 'PM' && hours !== 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            slotDate.setHours(hours, minutes, 0, 0);
            if (slotDate < new Date()) {
                alert('You cannot book a session in the past. Please select a future date and time.');
                setIsSubmitting(false);
                return;
            }
        }

        if (!isClient && !clients.some((c: any) => c.name === selectedClient)) {
            alert('Please select a valid client from the list.');
            setIsSubmitting(false);
            return;
        }

        // --- Trainer double-booking check ---
        if (!editingSession && selectedTrainer) {
            const trainer = trainers.find((t: any) => t.name === selectedTrainer);
            if (trainer) {
                // Admins/managers query sessions directly (always accurate, no stale data).
                // Clients use trainer_busy_slots (no permission to read all sessions).
                const conflictCollection = isClient ? 'trainer_busy_slots' : 'sessions';
                const conflictField = isClient ? 'trainerId' : 'trainerId';
                const existingSnap = await getDocs(
                    query(collection(db, conflictCollection), where(conflictField, '==', trainer.id))
                );
                const existingTimes = new Map<string, boolean>();
                existingSnap.forEach(d => {
                    const s = d.data();
                    const dateKey = new Date(s.date).toDateString();
                    existingTimes.set(`${dateKey}|${s.time}`, true);
                });

                const conflicts: string[] = [];
                const conflictKeySet = new Set<string>(); // Only actual clashing dates
                const baseDate = selectedSlot?.date ? new Date(selectedSlot.date) : new Date();

                if (isRepeating) {
                    // Generate all dates in the series and check each
                    const endDate = isClient
                        ? getClientMaxDate()
                        : new Date(new Date().getFullYear() + 2, new Date().getMonth(), new Date().getDate());
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);

                    for (const dayIdx of selectedDays) {
                        let currentDate = new Date(baseDate);
                        const currentDay = currentDate.getDay();
                        const targetDay = (dayIdx + 1) % 7;
                        let diff = targetDay - currentDay;
                        if (diff < 0) diff += 7;
                        currentDate.setDate(currentDate.getDate() + diff);
                        if (currentDate < todayStart) currentDate.setDate(currentDate.getDate() + 7);

                        while (currentDate <= endDate) {
                            const key = `${currentDate.toDateString()}|${selectedTime}`;
                            if (existingTimes.has(key)) {
                                conflicts.push(currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + selectedTime);
                                conflictKeySet.add(key); // Only add the dates that actually clash
                            }
                            currentDate.setDate(currentDate.getDate() + 7);
                        }
                    }
                } else {
                    // Single booking: compute exact target date
                    const currentDay = baseDate.getDay();
                    const targetDay = (selectedDay + 1) % 7;
                    const diff = targetDay - currentDay;
                    baseDate.setDate(baseDate.getDate() + (diff < 0 ? diff + 7 : diff));
                    const key = `${baseDate.toDateString()}|${selectedTime}`;
                    if (existingTimes.has(key)) {
                        conflicts.push(baseDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + selectedTime);
                        conflictKeySet.add(key);
                    }
                }

                if (conflicts.length > 0) {
                    if (!isRepeating) {
                        // For single bookings, just block entirely
                        setConflictModal({
                            conflicts,
                            conflictKeys: conflictKeySet,
                            resolve: () => {
                                setConflictModal(null);
                                setIsSubmitting(false);
                            }
                        });
                        return;
                    }

                    // For recurring: ask whether to skip clashes and continue
                    const shouldSkip = await showConflictModal(conflicts, conflictKeySet);
                    setConflictModal(null);
                    if (!shouldSkip) {
                        setIsSubmitting(false);
                        return;
                    }
                    // Store conflict keys so we can skip them during write
                    (window as any).__conflictKeys = conflictKeySet;
                } else {
                    (window as any).__conflictKeys = null;
                }
            }
        }
        // --- End conflict check ---

        const confirmed = await confirm({
            title: editingSession ? 'Confirm Changes?' : 'Confirm Booking?',
            message: isRepeating 
                ? `Are you sure you want to schedule this recurring series for ${selectedClient}?`
                : `Are you sure you want to book this session for ${selectedClient} on ${selectedTime}?`,
            confirmLabel: editingSession ? 'Save Changes' : 'Confirm Booking',
            type: 'info'
        });

        if (!confirmed) {
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
                clientName: isClient ? (profile?.name || user?.displayName || 'Client') : (selectedClient || editingSession?.clientName),
                clientId: isClient ? (profile?.clientId || user?.uid) : (client?.id || null),
                trainerName: selectedTrainer,
                trainerId: trainer?.id || null,
                serviceName: selectedService || editingSession?.serviceName,
                serviceId: service?.id || null,
                time: selectedTime,
                day: dayIdx,
                date: date.toISOString(),
                status: 'Scheduled',
                siteId: SITE_ID,
                createdAt: new Date().toISOString(),
                createdBy: profile?.name || 'Unknown User'
            };
        };

        const logActivity = async (action: 'booked' | 'rescheduled', sessionDetails: any, recurringDetails?: string) => {
            try {
                await addDoc(collection(db, 'activity_logs'), {
                    action,
                    isRecurring: !!recurringDetails,
                    sessionDetails: {
                        clientName: sessionDetails.clientName,
                        trainerName: sessionDetails.trainerName,
                        serviceName: sessionDetails.serviceName,
                        date: sessionDetails.date,
                        time: sessionDetails.time,
                        recurringDetails: recurringDetails || null
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
                    const endDate = new Date(new Date().getFullYear() + 2, new Date().getMonth(), new Date().getDate());
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);

                    const effectiveDays = selectedDays.length > 0 ? selectedDays : [selectedDay];
                    const sortedDays = [...effectiveDays].sort((a, b) => a - b);
                    const dayNames = sortedDays.map(d => {
                        const name = daysMap[d];
                        return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
                    });
                    const newRecurringDetails = `Weekly on ${dayNames.join(', ')}`;

                    // Step 1: Delete all future sessions in this series
                    const deleteSnap = await getDocs(
                        query(
                            collection(db, 'sessions'),
                            where('seriesId', '==', editingSession.seriesId),
                            where('date', '>=', editingSession.date)
                        )
                    );
                    let deleteBatch = writeBatch(db);
                    let delCount = 0;
                    deleteSnap.forEach((docSnap) => {
                        deleteBatch.delete(docSnap.ref);
                        delCount++;
                        if (delCount >= 450) {
                            deleteBatch.commit();
                            deleteBatch = writeBatch(db);
                            delCount = 0;
                        }
                    });
                    if (delCount > 0) await deleteBatch.commit();

                    // Step 2: Recreate from start date with new days
                    const trainer = trainers.find((t: any) => t.name === selectedTrainer);
                    const service = services.find((s: any) => s.name === (selectedService || editingSession?.serviceName));
                    const newSeriesData = (date: Date, dayIdx: number) => ({
                        clientName: editingSession.clientName,
                        clientId: editingSession.clientId,
                        trainerName: selectedTrainer,
                        trainerId: trainer?.id || editingSession.trainerId,
                        serviceName: selectedService || editingSession.serviceName,
                        serviceId: service?.id || editingSession.serviceId,
                        time: selectedTime,
                        day: dayIdx,
                        date: date.toISOString(),
                        status: 'Scheduled',
                        siteId: SITE_ID,
                        seriesId: editingSession.seriesId,
                        recurringDetails: newRecurringDetails,
                        createdAt: new Date().toISOString(),
                        createdBy: profile?.name || 'Unknown User'
                    });

                    let sessionBatch = writeBatch(db);
                    let opCount = 0;
                    const commitIfFull = async () => {
                        if (opCount >= 450) {
                            await sessionBatch.commit();
                            sessionBatch = writeBatch(db);
                            opCount = 0;
                        }
                    };

                    for (const dayIdx of effectiveDays) {
                        let currentDate = new Date(baseDate);
                        const currentDay = currentDate.getDay();
                        const targetDay = (dayIdx + 1) % 7;
                        let diff = targetDay - currentDay;
                        if (diff < 0) diff += 7;
                        if (diff === 0 && currentDate < todayStart) diff = 7;
                        currentDate.setDate(currentDate.getDate() + diff);
                        if (currentDate < todayStart) currentDate.setDate(currentDate.getDate() + 7);

                        while (currentDate <= endDate) {
                            sessionBatch.set(doc(collection(db, 'sessions')), newSeriesData(new Date(currentDate), dayIdx));
                            opCount++;
                            await commitIfFull();
                            currentDate.setDate(currentDate.getDate() + 7);
                        }
                    }
                    if (opCount > 0) await sessionBatch.commit();
                    await logActivity('rescheduled', getBookingData(baseDate, selectedDay), newRecurringDetails);
                } else {
                    const updatedData = getBookingData(baseDate, selectedDay);
                    await updateDoc(doc(db, 'sessions', editingSession.id), updatedData);
                    await logActivity('rescheduled', updatedData);
                }
            } else if (isRepeating) {
                const seriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                let recurringDetails = '';
                if (repeatFrequency === 'daily') {
                    recurringDetails = 'Daily';
                } else {
                    const sortedDays = [...selectedDays].sort((a, b) => a - b);
                    const dayNames = sortedDays.map(d => {
                        const name = daysMap[d];
                        return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
                    });
                    recurringDetails = `Weekly on ${dayNames.join(', ')}`;
                }

                // Admin/managers: always weekly, 2 years out
                // Clients: max 14 days
                const endDate = isClient
                    ? getClientMaxDate()
                    : new Date(new Date().getFullYear() + 2, new Date().getMonth(), new Date().getDate());

                // For admin/managers, always use weekly
                const effectiveFrequency = isAdmin ? 'weekly' : repeatFrequency;

                console.log(`[BOOKING] Recurring: freq=${effectiveFrequency}, endDate=${endDate.toISOString()}, selectedDays=${JSON.stringify(selectedDays)}`);

                const getSeriesData = (date: Date, dayIdx: number) => ({
                    ...getBookingData(date, dayIdx),
                    seriesId,
                    recurringDetails
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

                if (effectiveFrequency === 'daily') {
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
                            const skipKey = `${currentDate.toDateString()}|${selectedTime}`;
                            const skipKeys: Set<string> | null = (window as any).__conflictKeys || null;
                            if (!skipKeys || !skipKeys.has(skipKey)) {
                                sessionBatch.set(doc(collection(db, 'sessions')), getSeriesData(new Date(currentDate), dayIdx));
                                opCount++;
                                await commitIfFull();
                            }
                            currentDate.setDate(currentDate.getDate() + 7);
                        }
                    }
                }
                if (opCount > 0) await sessionBatch.commit();
                console.log(`[BOOKING] Created ${opCount} recurring sessions`);
                if (opCount === 0) {
                    alert(`No sessions were created. Please check your selected days and end date.`);
                    setIsSubmitting(false);
                    return;
                }
                await logActivity('booked', getBookingData(baseDate, selectedDay), recurringDetails);

            } else {
                // Single booking
                const currentDay = baseDate.getDay();
                const targetDay = (selectedDay + 1) % 7;
                const diff = targetDay - currentDay;
                baseDate.setDate(baseDate.getDate() + (diff < 0 ? diff + 7 : diff));
                const bookingData = getBookingData(baseDate, selectedDay);
                await addDoc(collection(db, 'sessions'), bookingData);
                await logActivity('booked', bookingData);
            }
            
            setIsSubmitting(false);
            onBook({});
            onClose();
        } catch (error) {
            console.error('Error saving session:', error);
            alert('Failed to save session.');
            setIsSubmitting(false);
        }
    };

    return (
        <>
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
                                        {timeSlots.map(t => {
                                            const slotDate = getTargetDateForDayIndex(selectedDay);
                                            const isToday = slotDate.toDateString() === new Date().toDateString();
                                            let isPast = false;
                                            if (isToday) {
                                                const [timePart, mod] = t.split(' ');
                                                let [h, m] = timePart.split(':').map(Number);
                                                if (mod === 'PM' && h !== 12) h += 12;
                                                if (mod === 'AM' && h === 12) h = 0;
                                                const slotMinutes = h * 60 + m;
                                                const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
                                                isPast = slotMinutes <= nowMinutes;
                                            }
                                            return (
                                                <option key={t} value={t} disabled={isPast} style={{ color: isPast ? '#ccc' : undefined }}>
                                                    {t}{isPast ? ' (past)' : ''}
                                                </option>
                                            );
                                        })}
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
                                                    // Admin/Manager View — simplified: weekly + 2 years, auto
                                                    <div style={{ background: '#f5f5f5', padding: '12px', border: '1px solid #ddd' }}>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>
                                                            Repeats <strong>weekly</strong> from the selected date. Select the days below.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    // Client View
                                                    <div style={{ background: '#fff5f5', padding: '12px', border: '1px solid #ffcccc' }}>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#cc0000' }}>
                                                            Recurring bookings are limited to 2 weeks in advance. This series will end on <strong style={{ color: '#000' }}>{getClientMaxDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {(isAdmin || repeatFrequency === 'weekly') && (
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

                        {/* Day selector when editing a future recurring series */}
                        {editingSession?.seriesId && editMode === 'future' && (
                            <div>
                                <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>NEW REPEAT DAYS</label>
                                <div style={{ padding: '16px', border: '2px solid #000', background: '#f5f5f5' }}>
                                    <p style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>
                                        Select which days this series should repeat on from <strong>{new Date(editingSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> onwards.
                                    </p>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {days.map((day, i) => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => toggleDay(i)}
                                                title={day}
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
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
                                    {selectedDays.length === 0 && (
                                        <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#f44336', fontWeight: 700 }}>
                                            Please select at least one day.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        <div style={{
                            borderTop: '2px solid #eee',
                            paddingTop: '16px',
                            paddingBottom: '4px',
                            marginTop: '12px',
                        }}>
                            <button
                                type="submit"
                                className="button-primary"
                                disabled={(availableTrainers.length === 0 && !editingSession) || isSubmitting}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    opacity: ((availableTrainers.length === 0 && !editingSession) || isSubmitting) ? 0.5 : 1,
                                    cursor: isSubmitting ? 'wait' : 'pointer'
                                }}
                            >
                                {isSubmitting ? 'Processing...' : `Confirm ${editingSession ? 'Changes' : 'Booking'}`}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        {conflictModal && (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.85)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 2000, backdropFilter: 'blur(4px)'
            }}>
                <div className="card" style={{
                    width: '95%', maxWidth: '480px', padding: '32px',
                    background: '#fff', border: '4px solid #000'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{
                            width: '40px', height: '40px', background: '#fff3cd',
                            border: '2px solid #f0ad4e', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            fontSize: '1.2rem'
                        }}>⚠️</div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Double-Booking Detected</h2>
                    </div>
                    <p style={{ color: '#555', marginBottom: '16px', fontSize: '0.95rem' }}>
                        <strong>{selectedTrainer}</strong> is already booked on the following date{conflictModal.conflicts.length > 1 ? 's' : ''}:
                    </p>
                    <div style={{
                        background: '#f9f9f9', border: '1px solid #e0e0e0',
                        borderRadius: '4px', padding: '12px 16px', marginBottom: '24px',
                        maxHeight: '200px', overflowY: 'auto'
                    }}>
                        {conflictModal.conflicts.slice(0, 10).map((c, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '6px 0',
                                borderBottom: i < Math.min(conflictModal.conflicts.length, 10) - 1 ? '1px solid #eee' : 'none',
                                fontSize: '0.9rem', fontWeight: 600
                            }}>
                                <span style={{ color: '#999', fontSize: '0.8rem' }}>•</span>
                                {c}
                            </div>
                        ))}
                        {conflictModal.conflicts.length > 10 && (
                            <div style={{ color: '#999', fontSize: '0.8rem', paddingTop: '8px' }}>
                                ...and {conflictModal.conflicts.length - 10} more
                            </div>
                        )}
                    </div>
                    {isRepeating ? (
                        <>
                            <p style={{ color: '#555', marginBottom: '24px', fontSize: '0.9rem' }}>
                                Would you like to <strong>skip these clashing dates</strong> and continue booking the remaining sessions?
                            </p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    className="button-secondary"
                                    style={{ flex: 1, height: '54px' }}
                                    onClick={() => conflictModal.resolve(false)}
                                >
                                    CANCEL
                                </button>
                                <button
                                    style={{
                                        flex: 1, height: '54px', background: '#000', color: '#fff',
                                        border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem'
                                    }}
                                    onClick={() => conflictModal.resolve(true)}
                                >
                                    SKIP & CONTINUE
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p style={{ color: '#555', marginBottom: '24px', fontSize: '0.9rem' }}>
                                Please choose a different trainer or time.
                            </p>
                            <button
                                style={{
                                    width: '100%', height: '54px', background: '#000', color: '#fff',
                                    border: 'none', fontWeight: 800, cursor: 'pointer'
                                }}
                                onClick={() => conflictModal.resolve(false)}
                            >
                                OK
                            </button>
                        </>
                    )}
                </div>
            </div>
        )}
        </>
    );
};
