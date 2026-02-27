import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { BookingModal } from './BookingModal';
import { SessionDetailModal } from './SessionDetailModal';
import { OffDayModal } from './OffDayModal';
import { ConfirmOffDayModal } from './ConfirmOffDayModal';
import { useFirestore } from '../hooks/useFirestore';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { SITE_ID } from '../constants';

const formatWeekRange = (start: Date) => {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${start.getFullYear()}`;
};

const getDayDate = (start: Date, dayIndex: number) => {
    const date = new Date(start);
    date.setDate(start.getDate() + dayIndex);
    return date.getDate();
};

const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
};

export const CalendarView = () => {
    const [selectedSlot, setSelectedSlot] = useState<{ day: number; time: string; date?: Date; trainerId?: string | null } | null>(null);
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [excludedTrainerId, setExcludedTrainerId] = useState<string | null>(null);
    const [offDayModalOpen, setOffDayModalOpen] = useState(false);
    const [offDayDate, setOffDayDate] = useState<Date | null>(null);
    const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
    const [selectedTrainerId, setSelectedTrainerId] = useState<string>('all');
    const { profile, user } = useAuth();
    const isAdmin = profile?.role === 'admin';
    const isTrainer = profile?.role === 'trainer';
    const isClient = profile?.role === 'client';

    const limitDate = new Date();
    limitDate.setHours(23, 59, 59, 999);
    limitDate.setDate(limitDate.getDate() + 14);

    const isNextWeekBlocked = isClient && (() => {
        const nextWeekStart = new Date(currentWeekStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        return nextWeekStart > limitDate;
    })();

    // Fetch live sessions, trainers, and off-days
    const { data: sessions } = useFirestore<any>('sessions');
    const { data: trainers } = useFirestore<any>('trainers');
    const { data: offDays } = useFirestore<any>('off_days');

    // Auto-filter for trainers
    React.useEffect(() => {
        if (isTrainer && profile?.trainerId) {
            setSelectedTrainerId(profile.trainerId);
        }
    }, [isTrainer, profile]);

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const timeSlots = [
        '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM',
        '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM'
    ];

    const daysMap: { [key: number]: string } = {
        0: 'monday', 1: 'tuesday', 2: 'wednesday', 3: 'thursday', 4: 'friday', 5: 'saturday', 6: 'sunday'
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

    const isTrainerAvailable = (dayIndex: number, time: string) => {
        const dayName = daysMap[dayIndex];
        const slotTime = convertTo24h(time);

        const activeTrainers = selectedTrainerId === 'all'
            ? trainers
            : trainers.filter(t => t.id === selectedTrainerId);

        const slotDate = new Date(currentWeekStart);
        slotDate.setDate(slotDate.getDate() + dayIndex);
        const dateStr = slotDate.toISOString().split('T')[0];

        return activeTrainers.some(trainer => {
            // Check if day is marked as persistent OFF in Firestore
            const isOff = offDays.some((od: any) => od.trainerId === trainer.id && od.date === dateStr);
            if (isOff) return false;

            const daySchedule = trainer.availability?.[dayName];
            if (!daySchedule || !daySchedule.active || !daySchedule.shifts) return false;

            // Check if slot falls within ANY of the trainer's shifts for that day
            return daySchedule.shifts.some((shift: any) => {
                const startTime = convertTo24h(shift.start);
                const endTime = convertTo24h(shift.end);
                return slotTime >= startTime && slotTime < endTime;
            });
        });
    };

    const handlePrevWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() - 7);
        setCurrentWeekStart(d);
    };

    const handleNextWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + 7);
        setCurrentWeekStart(d);
    };

    const handleToday = () => {
        setCurrentWeekStart(getStartOfWeek(new Date()));
    };

    const handleCleanDilip = async () => {
        if (!isAdmin) return;
        const confirmMsg = "Are you sure you want to clean up Dilip's bugged sessions? This will delete all sessions for 'Dilip Sinha' created in the last 24 hours.";
        if (!window.confirm(confirmMsg)) return;

        try {
            const sessionsRef = collection(db, 'sessions');
            const q = query(sessionsRef, where('clientName', '==', 'Dilip Sinha'));
            const snapshot = await getDocs(q);

            let deletedCount = 0;
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const deletePromises: Promise<void>[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.createdAt) {
                    const createdAtDate = new Date(data.createdAt);
                    if (createdAtDate > yesterday) {
                        deletePromises.push(deleteDoc(doc(db, 'sessions', docSnap.id)));
                        deletedCount++;
                    }
                }
            });

            await Promise.all(deletePromises);
            alert(`Cleanup complete! Deleted ${deletedCount} bugged sessions.`);
        } catch (err) {
            console.error(err);
            alert("Error cleaning up sessions.");
        }
    };

    const handleSlotClick = (dayIndex: number, time: string) => {
        const effectiveTrainerId = isTrainer ? profile?.trainerId : (selectedTrainerId === 'all' ? null : selectedTrainerId);

        const slotDate = new Date(currentWeekStart);
        slotDate.setDate(slotDate.getDate() + dayIndex);
        const isPastLimit = isClient && slotDate > limitDate;

        let available = isTrainerAvailable(dayIndex, time) && !isPastLimit;

        // Block double booking the same trainer if viewing individually
        if (selectedTrainerId !== 'all') {
            const isBooked = sessions.some((s: any) => s.day === dayIndex && s.time === time && s.trainerId === selectedTrainerId);
            if (isBooked) available = false;
        }

        // Prevent trainers from booking sessions
        if (available && !isTrainer) {
            setSelectedSlot({ day: dayIndex, time, trainerId: effectiveTrainerId, date: slotDate });
        }
    };

    const [confirmOffDayOpen, setConfirmOffDayOpen] = useState(false);

    const handleDayHeaderClick = async (dayIndex: number) => {
        if (!isAdmin || selectedTrainerId === 'all') return;

        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + dayIndex);
        const dateStr = date.toISOString().split('T')[0];

        // Check if already an off-day
        const existingOffDay = offDays.find((od: any) => od.trainerId === selectedTrainerId && od.date === dateStr);

        if (existingOffDay) {
            if (window.confirm('Remove off-day status for this date?')) {
                try {
                    await deleteDoc(doc(db, 'off_days', existingOffDay.id));
                } catch (err) {
                    console.error('Error removing off-day:', err);
                }
            }
            return;
        }

        setOffDayDate(date);
        setConfirmOffDayOpen(true);
    };

    const handleBookButtonClick = () => {
        // Open with default or today's slot
        const today = new Date();
        const dayIndex = Math.max(0, today.getDay() - 1); // Mon=0, Sun=6
        setSelectedSlot({
            day: dayIndex,
            time: '09:00 AM',
            trainerId: selectedTrainerId === 'all' ? null : selectedTrainerId,
            date: today
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
            <header style={{
                padding: window.innerWidth <= 768 ? '16px 20px' : '20px 40px',
                borderBottom: '2px solid #000',
                display: 'flex',
                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                gap: '20px',
                justifyContent: 'space-between',
                alignItems: window.innerWidth <= 768 ? 'stretch' : 'center',
                background: '#fff'
            }}>
                {/* Left: Branding/Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>SCHEDULE</h1>
                    {window.innerWidth <= 768 && (
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                            {formatWeekRange(currentWeekStart)}
                        </span>
                    )}
                </div>

                {/* Center: Navigation & Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth <= 768 ? '12px' : '32px', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={handlePrevWeek} className="button-secondary" style={{ padding: '6px 10px', height: '36px' }}><ChevronLeft size={18} /></button>
                        <button
                            onClick={handleToday}
                            style={{
                                height: '36px',
                                padding: '0 16px',
                                background: '#000',
                                color: '#fff',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                letterSpacing: '0.05em'
                            }}
                        >
                            TODAY
                        </button>
                        <button
                            onClick={handleNextWeek}
                            disabled={isNextWeekBlocked}
                            className="button-secondary"
                            style={{
                                padding: '6px 10px',
                                height: '36px',
                                opacity: isNextWeekBlocked ? 0.3 : 1,
                                cursor: isNextWeekBlocked ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    {window.innerWidth > 768 && (
                        <span style={{ fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                            {formatWeekRange(currentWeekStart)}
                        </span>
                    )}
                </div>

                {/* Right: Controls & Primary Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexDirection: window.innerWidth <= 768 ? 'column' : 'row' }}>
                    {isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: window.innerWidth <= 768 ? '100%' : 'auto' }}>
                            <span style={{ fontWeight: 900, fontSize: '0.7rem', color: '#888', letterSpacing: '0.05em' }}>FILTER:</span>
                            <select
                                value={selectedTrainerId}
                                onChange={(e) => setSelectedTrainerId(e.target.value)}
                                style={{
                                    height: '42px',
                                    flex: window.innerWidth <= 768 ? 1 : 'none',
                                    padding: '0 16px',
                                    border: '2px solid #000',
                                    borderRadius: 0,
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    background: '#fff'
                                }}
                            >
                                <option value="all">All Trainers</option>
                                {trainers.map((t: any) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {isAdmin && (
                        <button
                            onClick={handleCleanDilip}
                            style={{
                                height: '42px',
                                padding: '0 20px',
                                background: '#e11d48',
                                color: '#fff',
                                border: '2px solid #e11d48',
                                fontWeight: 900,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                letterSpacing: '0.02em',
                                width: window.innerWidth <= 768 ? '100%' : 'auto',
                            }}
                        >
                            CLEAN BUGGED BOOKINGS
                        </button>
                    )}
                    {!isTrainer && (
                        <button
                            onClick={handleBookButtonClick}
                            style={{
                                height: '42px',
                                width: window.innerWidth <= 768 ? '100%' : 'auto',
                                padding: '0 20px',
                                background: '#000',
                                color: '#fff',
                                border: '2px solid #000',
                                fontWeight: 900,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                letterSpacing: '0.02em'
                            }}
                        >
                            <Plus size={18} />
                            BOOK SESSION
                        </button>
                    )}
                </div>
            </header>

            <div style={{ flex: 1, overflow: 'auto', padding: window.innerWidth <= 768 ? '0 16px' : '0 40px' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '60px repeat(7, 1fr)',
                    minWidth: window.innerWidth <= 768 ? '800px' : '1000px',
                    borderLeft: '2px solid #000',
                    borderRight: '2px solid #000'
                }}>
                    {/* Header */}
                    <div style={{ height: '60px', borderBottom: '2px solid #000' }}></div>
                    {days.map((day, i) => {
                        const slotDate = new Date(currentWeekStart);
                        slotDate.setDate(slotDate.getDate() + i);
                        const isToday = slotDate.toDateString() === new Date().toDateString();

                        return (
                            <div
                                key={day}
                                onClick={() => handleDayHeaderClick(i)}
                                style={{
                                    height: '60px',
                                    borderBottom: '2px solid #000',
                                    borderLeft: isToday ? '2px solid #000' : '1px solid #eee',
                                    borderRight: isToday ? '2px solid #000' : 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: (isAdmin && selectedTrainerId !== 'all') ? 'pointer' : 'default',
                                    background: isToday ? '#000' : ((isAdmin && selectedTrainerId !== 'all') ? '#fff' : '#fff'),
                                    transition: 'background 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    if (isAdmin && selectedTrainerId !== 'all') e.currentTarget.style.background = isToday ? '#222' : '#f9f9f9';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = isToday ? '#000' : '#fff';
                                }}
                            >
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isToday ? '#fff' : '#666' }}>{day}</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isToday ? '#fff' : 'inherit' }}>{getDayDate(currentWeekStart, i)}</span>
                            </div>
                        );
                    })}

                    {/* Time Slots */}
                    {timeSlots.map(time => (
                        <React.Fragment key={time}>
                            <div style={{
                                minHeight: '100px',
                                borderBottom: '1px solid #eee',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#999'
                            }}>
                                {time}
                            </div>
                            {days.map((_, dayIndex) => {
                                const slotDate = new Date(currentWeekStart);
                                slotDate.setDate(slotDate.getDate() + dayIndex);
                                const isPastLimit = isClient && slotDate > limitDate;
                                const isToday = slotDate.toDateString() === new Date().toDateString();

                                const slotSessions = sessions.filter((s: any) => {
                                    const matchDay = s.day === dayIndex && s.time === time;
                                    if (selectedTrainerId === 'all') return matchDay;
                                    return matchDay && s.trainerId === selectedTrainerId;
                                });

                                const displaySessions = slotSessions.filter((s: any) => !isClient || s.clientName === profile?.name);

                                const available = isTrainerAvailable(dayIndex, time) && !isPastLimit && slotSessions.length === 0;
                                const showAsAvailable = selectedTrainerId === 'all' || available;

                                let baseBackgroundColor = showAsAvailable ? 'transparent' : '#fafafa';
                                if (isToday && showAsAvailable) {
                                    baseBackgroundColor = '#f5f5f5'; // muted gray for today's empty slots
                                }

                                return (
                                    <div
                                        key={`${dayIndex}-${time}`}
                                        onClick={() => handleSlotClick(dayIndex, time)}
                                        style={{
                                            borderBottom: '1px solid #eee',
                                            borderLeft: isToday ? '2px solid #000' : '1px solid #eee',
                                            borderRight: isToday ? '2px solid #000' : 'none',
                                            position: 'relative',
                                            minHeight: '100px',
                                            padding: '4px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px',
                                            cursor: displaySessions.length > 0 ? (selectedTrainerId === 'all' ? 'pointer' : 'default') : (showAsAvailable ? 'pointer' : 'not-allowed'),
                                            backgroundColor: baseBackgroundColor,
                                            backgroundImage: displaySessions.length === 0 && !showAsAvailable
                                                ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, #e0e0e0 10px, #e0e0e0 20px)'
                                                : 'none',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {displaySessions.map((displaySession: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="session-card"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // prevent triggering a new booking
                                                    setSelectedSession(displaySession);
                                                }}
                                                style={{
                                                    backgroundColor: '#000',
                                                    borderRadius: '4px',
                                                    padding: '8px',
                                                    color: '#fff',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    cursor: 'pointer',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{displaySession.clientName}</div>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{displaySession.serviceName}</div>
                                                </div>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 700, marginTop: '4px' }}>{displaySession.trainerName}</div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </React.Fragment>

                    ))}
                </div>
            </div>

            <BookingModal
                isOpen={!!selectedSlot}
                onClose={() => {
                    setSelectedSlot(null);
                    setSelectedSession(null);
                    setExcludedTrainerId(null);
                }}
                selectedSlot={selectedSlot}
                editingSession={selectedSession}
                excludedTrainerId={excludedTrainerId}
                onBook={(data) => {
                    console.log('Session booked/updated:', data);
                    setSelectedSlot(null);
                    setSelectedSession(null);
                    setExcludedTrainerId(null);
                }}
            />

            <SessionDetailModal
                isOpen={!!selectedSession && !selectedSlot}
                onClose={() => setSelectedSession(null)}
                session={selectedSession}
                onDelete={(id) => {
                    console.log('Session deleted:', id);
                    setSelectedSession(null);
                }}
                onReschedule={(session) => {
                    setSelectedSlot({
                        day: session.day,
                        time: session.time,
                        trainerId: session.trainerId
                    });
                    // selectedSession stays set so BookingModal knows we are editing
                }}
            />

            <ConfirmOffDayModal
                isOpen={confirmOffDayOpen}
                onClose={() => setConfirmOffDayOpen(false)}
                onConfirm={async () => {
                    if (!selectedTrainerId || !offDayDate) return;

                    try {
                        const dateStr = offDayDate.toISOString().split('T')[0];
                        await addDoc(collection(db, 'off_days'), {
                            trainerId: selectedTrainerId,
                            date: dateStr,
                            siteId: SITE_ID,
                            createdBy: user?.uid || 'unknown',
                            timestamp: new Date().toISOString()
                        });

                        setConfirmOffDayOpen(false);
                        setOffDayModalOpen(true);
                    } catch (err) {
                        console.error('Error saving off-day:', err);
                        alert('Failed to save off-day status.');
                    }
                }}
                trainerName={trainers.find(t => t.id === selectedTrainerId)?.name || ''}
                date={offDayDate || new Date()}
            />

            <OffDayModal
                isOpen={offDayModalOpen}
                onClose={() => setOffDayModalOpen(false)}
                trainer={trainers.find(t => t.id === selectedTrainerId)}
                date={offDayDate || new Date()}
                sessions={sessions.filter((s: any) => {
                    if (!offDayDate) return false;
                    const logDate = new Date(s.date).toISOString().split('T')[0];
                    const selectedDate = offDayDate.toISOString().split('T')[0];
                    return s.trainerId === selectedTrainerId && logDate === selectedDate;
                })}
                onReschedule={(session) => {
                    setSelectedSession(session);
                    setExcludedTrainerId(session.trainerId);
                    setSelectedSlot({
                        day: session.day,
                        time: session.time,
                        trainerId: session.trainerId,
                        date: new Date(session.date)
                    });
                    setOffDayModalOpen(false);
                }}
                onRefresh={() => {
                    // Firestore handles live updates via useFirestore
                }}
            />
        </div>
    );
};
