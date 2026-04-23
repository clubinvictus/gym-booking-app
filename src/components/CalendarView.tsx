import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { BookingModal } from './BookingModal';
import { SessionDetailModal } from './SessionDetailModal';
import { OffDayModal } from './OffDayModal';
import { ConfirmOffDayModal } from './ConfirmOffDayModal';
import { WeekGrid } from './WeekGrid';
import { ResourceGrid } from './ResourceGrid';
import { useFirestore } from '../hooks/useFirestore';
import { useAuth } from '../AuthContext';
import { useSessions } from '../hooks/useSessions';
import { useConfirm } from '../ConfirmContext';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { SITE_ID } from '../constants';

const formatWeekRange = (start: Date) => {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${start.getFullYear()}`;
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
    const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

    // Auto-refresh the week reference if the app is left open overnight
    React.useEffect(() => {
        const refreshDate = () => {
            const freshStart = getStartOfWeek(new Date());
            // Only update if the week start date has actually changed
            if (freshStart.getTime() !== currentWeekStart.getTime()) {
                console.log('Week rollover detected, refreshing calendar...');
                setCurrentWeekStart(freshStart);
            }
        };

        window.addEventListener('focus', refreshDate);
        const interval = setInterval(refreshDate, 60000); // Check every minute as well

        return () => {
            window.removeEventListener('focus', refreshDate);
            clearInterval(interval);
        };
    }, [currentWeekStart]);
    const { profile, user } = useAuth();
    const [selectedTrainerId, setSelectedTrainerId] = useState<string>('all');
    const confirm = useConfirm();
    const isAdmin = profile?.role === 'admin';
    const isManager = profile?.role === 'manager';
    const isTrainer = profile?.role === 'trainer';
    const isClient = profile?.role === 'client';
    
    const clientIds = useMemo(() => {
        if (!profile) return [];
        if (profile.clientIds) return profile.clientIds;
        if (profile.clientId) return [profile.clientId];
        return [];
    }, [profile]);

    // Set default filter once profile loads
    React.useEffect(() => {
        if (profile?.role === 'client' && selectedTrainerId === 'all') {
            setSelectedTrainerId('my');
        }
    }, [profile, selectedTrainerId]);

    const limitDate = new Date();
    limitDate.setHours(23, 59, 59, 999);
    limitDate.setDate(limitDate.getDate() + 14);

    const isNextWeekBlocked = isClient && (() => {
        const nextWeekStart = new Date(currentWeekStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        return nextWeekStart > limitDate;
    })();

    // Calculate start and end of visible week for optimized fetching
    const { weekStartDate, weekEndDate } = useMemo(() => {
        const start = new Date(currentWeekStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentWeekStart);
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 999);
        return { weekStartDate: start, weekEndDate: end };
    }, [currentWeekStart]);

    // Use centralized session hook with range filtering
    const { sessions } = useSessions({
        role: profile?.role as any || 'admin',
        userId: user?.uid || '',
        clientId: profile?.role === 'client' ? profile?.clientId : undefined,
        startDate: weekStartDate,
        endDate: weekEndDate,
        includePast: true,
        pageSize: 200, // Enough to cover a busy week
        trainerId: (isAdmin || isManager || isTrainer) && selectedTrainerId !== 'all' && selectedTrainerId !== 'my' ? selectedTrainerId : 
                  (isTrainer && selectedTrainerId === 'my' ? profile?.trainerId : undefined)
    });
    const { data: busySlots } = useFirestore<any>('trainer_busy_slots');
    const { data: trainers } = useFirestore<any>('trainers');
    const { data: offDays } = useFirestore<any>('off_days');
    const { data: services } = useFirestore<any>('services');

    const [confirmOffDayOpen, setConfirmOffDayOpen] = useState(false);

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

    const handleDayHeaderClick = async (dayIndex: number) => {
        if (!isAdmin || selectedTrainerId === 'all' || selectedTrainerId === 'my') return;

        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + dayIndex);
        const dateStr = date.toISOString().split('T')[0];

        // Check if already an off-day
        const existingOffDay = offDays.find((od: any) => od.trainerId === selectedTrainerId && od.date === dateStr);

        if (existingOffDay) {
            const confirmed = await confirm({
                title: 'Remove Off-Day',
                message: 'Remove off-day status for this date?',
                confirmLabel: 'Remove Off-Day',
                type: 'warning'
            });

            if (confirmed) {
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
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

        const jsDow = nextHour.getDay();
        const dayIndex = jsDow === 0 ? 6 : jsDow - 1;

        const timeStr = nextHour.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).replace(/\u202F/g, ' ');

        setSelectedSlot({
            day: dayIndex,
            time: timeStr,
            trainerId: (selectedTrainerId === 'all' || selectedTrainerId === 'my') ? null : selectedTrainerId,
            date: nextHour
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
            <header style={{
                padding: window.innerWidth <= 768 ? '16px 20px' : '20px 40px',
                borderBottom: '2px solid #000',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                background: '#fff'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <h1 style={{ fontSize: window.innerWidth <= 768 ? '1.8rem' : '1.6rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>SCHEDULE</h1>
                    {window.innerWidth <= 768 && !isTrainer && (
                        <button
                            onClick={handleBookButtonClick}
                            style={{
                                height: '42px',
                                width: '42px',
                                background: '#000',
                                color: '#fff',
                                border: '2px solid #000',
                                fontWeight: 900,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                borderRadius: 0
                            }}
                        >
                            <Plus size={24} />
                        </button>
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: window.innerWidth <= 768 ? 'stretch' : 'center',
                    gap: window.innerWidth <= 768 ? '12px' : '16px'
                }}>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        gap: '16px',
                        width: window.innerWidth <= 768 ? '100%' : 'auto'
                    }}>
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
                        <span style={{ 
                            fontWeight: 800, 
                            fontSize: window.innerWidth <= 768 ? '0.85rem' : '1.1rem', 
                            whiteSpace: 'nowrap' 
                        }}>
                            {formatWeekRange(currentWeekStart)}
                        </span>
                    </div>

                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: '12px',
                        width: window.innerWidth <= 768 ? '100%' : 'auto'
                    }}>
                        {(isAdmin || isClient) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: window.innerWidth <= 768 ? 1 : 'none' }}>
                                {window.innerWidth > 768 && <span style={{ fontWeight: 900, fontSize: '0.7rem', color: '#888', letterSpacing: '0.05em' }}>FILTER:</span>}
                                <select
                                    value={selectedTrainerId}
                                    onChange={(e) => setSelectedTrainerId(e.target.value)}
                                    style={{
                                        height: '42px',
                                        width: '100%',
                                        padding: '0 12px',
                                        border: '2px solid #000',
                                        borderRadius: 0,
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        background: '#fff'
                                    }}
                                >
                                    {isClient ? (
                                        <option value="my">My Calendar</option>
                                    ) : (
                                        <option value="all">All Trainers</option>
                                    )}
                                    {trainers.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        {(isAdmin || isManager) && (
                            <div style={{ 
                                display: 'flex', 
                                border: '2px solid #000', 
                                borderRadius: '4px', 
                                overflow: 'hidden', 
                                height: '42px',
                                flex: window.innerWidth <= 768 ? 1 : 'none'
                            }}>
                                <button
                                    onClick={() => setViewMode('week')}
                                    style={{
                                        padding: '0 12px',
                                        background: viewMode === 'week' ? '#000' : '#fff',
                                        color: viewMode === 'week' ? '#fff' : '#000',
                                        fontWeight: 800,
                                        border: 'none',
                                        cursor: 'pointer',
                                        flex: 1,
                                        height: '100%'
                                    }}
                                >
                                    WEEK
                                </button>
                                <button
                                    onClick={() => setViewMode('day')}
                                    style={{
                                        padding: '0 12px',
                                        background: viewMode === 'day' ? '#000' : '#fff',
                                        color: viewMode === 'day' ? '#fff' : '#000',
                                        fontWeight: 800,
                                        border: 'none',
                                        borderLeft: '2px solid #000',
                                        cursor: 'pointer',
                                        flex: 1,
                                        height: '100%'
                                    }}
                                >
                                    DAY
                                </button>
                            </div>
                        )}

                        {window.innerWidth > 768 && !isTrainer && (
                            <button
                                onClick={handleBookButtonClick}
                                style={{
                                    height: '42px',
                                    width: '42px',
                                    background: '#000',
                                    color: '#fff',
                                    border: '2px solid #000',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    borderRadius: 0
                                }}
                            >
                                <Plus size={24} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {viewMode === 'week' ? (
                <WeekGrid
                    sessions={sessions}
                    trainers={trainers}
                    services={services}
                    busySlots={busySlots}
                    offDays={offDays}
                    currentWeekStart={currentWeekStart}
                    selectedTrainerId={selectedTrainerId}
                    clientIds={clientIds}
                    limitDate={limitDate}
                    isAdmin={isAdmin}
                    isClient={isClient}
                    isTrainer={isTrainer}
                    profile={profile}
                    onSlotSelected={setSelectedSlot}
                    onSessionClick={setSelectedSession}
                    onDayHeaderClick={handleDayHeaderClick}
                />
            ) : (
                <ResourceGrid
                    sessions={sessions}
                    trainers={trainers}
                    services={services}
                    busySlots={busySlots}
                    offDays={offDays}
                    currentWeekStart={currentWeekStart}
                    selectedTrainerId={selectedTrainerId}
                    clientIds={clientIds}
                    limitDate={limitDate}
                    isAdmin={isAdmin}
                    isClient={isClient}
                    isTrainer={isTrainer}
                    profile={profile}
                    onSlotSelected={setSelectedSlot}
                    onSessionClick={setSelectedSession}
                    onDayHeaderClick={handleDayHeaderClick}
                />
            )}

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
                onBook={(data: any) => {
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
                onDelete={(id: string) => {
                    console.log('Session deleted:', id);
                    setSelectedSession(null);
                }}
                onReschedule={(session: any) => {
                    setSelectedSlot({
                        day: session.day,
                        time: session.time,
                        trainerId: session.trainerId,
                        date: session.date ? new Date(session.date) : new Date()
                    });
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
