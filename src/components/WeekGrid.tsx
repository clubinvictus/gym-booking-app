import React from 'react';

export interface GridProps {
    sessions: any[];
    trainers: any[];
    services: any[];
    busySlots: any[];
    offDays: any[];
    currentWeekStart: Date;
    selectedTrainerId: string;
    clientIds: string[];
    limitDate: Date;
    isAdmin: boolean;
    isClient: boolean;
    isTrainer: boolean;
    profile: any;
    onSlotSelected: (slotData: { day: number; time: string; trainerId: string | null; date: Date }) => void;
    onSessionClick: (session: any) => void;
    onDayHeaderClick: (dayIndex: number) => void;
}

export const WeekGrid: React.FC<GridProps> = ({
    sessions,
    trainers,
    services,
    busySlots,
    offDays,
    currentWeekStart,
    selectedTrainerId,
    clientIds,
    limitDate,
    isAdmin,
    isClient,
    isTrainer,
    profile,
    onSlotSelected,
    onSessionClick,
    onDayHeaderClick
}) => {
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

    const getDayDate = (start: Date, dayIndex: number) => {
        const date = new Date(start);
        date.setDate(start.getDate() + dayIndex);
        return date.getDate();
    };

    const isTrainerAvailable = (dayIndex: number, time: string) => {
        const dayName = daysMap[dayIndex];
        const slotTime = convertTo24h(time);

        const activeTrainers = (selectedTrainerId === 'all' || selectedTrainerId === 'my')
            ? trainers
            : trainers.filter(t => t.id === selectedTrainerId);

        const slotDate = new Date(currentWeekStart);
        slotDate.setDate(slotDate.getDate() + dayIndex);
        const dateStr = slotDate.toISOString().split('T')[0];

        return activeTrainers.some(trainer => {
            const isOff = offDays.some((od: any) => od.trainerId === trainer.id && od.date === dateStr);
            if (isOff) return false;

            const daySchedule = trainer.availability?.[dayName];
            if (!daySchedule || !daySchedule.active || !daySchedule.shifts) return false;

            return daySchedule.shifts.some((shift: any) => {
                const startTime = convertTo24h(shift.start);
                const endTime = convertTo24h(shift.end);
                return slotTime >= startTime && slotTime < endTime;
            });
        });
    };

    const getSessionClientNames = (session: any) => {
        if (session.clients && Array.isArray(session.clients)) {
            return session.clients.map((c: any) => c.name).join(', ');
        }
        return session.clientName || 'Unknown Client';
    };

    const handleSlotClick = (dayIndex: number, time: string) => {
        const effectiveTrainerId = isTrainer ? profile?.trainerId : ((selectedTrainerId === 'all' || selectedTrainerId === 'my') ? null : selectedTrainerId);

        const slotDate = new Date(currentWeekStart);
        slotDate.setDate(slotDate.getDate() + dayIndex);
        const isPastLimit = isClient && slotDate > limitDate;

        let available = isTrainerAvailable(dayIndex, time) && !isPastLimit;

        if (selectedTrainerId !== 'all' && selectedTrainerId !== 'my') {
            const existingSessions = sessions.filter((s: any) => s.day === dayIndex && s.time === time && s.trainerId === selectedTrainerId);
            
            if (existingSessions.length > 0) {
                const session = existingSessions[0];
                const service = services.find((sv: any) => sv.id === session.serviceId);
                const maxCap = service?.max_capacity || 1;
                const currentCount = session.clients?.length || 1;
                
                if (currentCount >= maxCap) {
                    available = false;
                }
            }

            const slotDateStr = slotDate.toISOString().split('T')[0];
            const isBusy = busySlots.some((bs: any) => {
                const bsDate = bs.date ? bs.date.split('T')[0] : '';
                return bs.trainerId === selectedTrainerId && bsDate === slotDateStr && bs.time === time;
            });
            if (isBusy) available = false;
        }

        if (available && !isTrainer) {
            onSlotSelected({ day: dayIndex, time, trainerId: effectiveTrainerId, date: slotDate });
        }
    };

    return (
        <div style={{ flex: 1, overflow: 'auto', padding: window.innerWidth <= 768 ? '0 16px' : '0 40px' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: '60px repeat(7, 1fr)',
                minWidth: window.innerWidth <= 768 ? '800px' : '1000px',
                borderLeft: '2px solid #000',
                borderRight: '2px solid #000'
            }}>
                {/* Sticky Day Header Row */}
                <div style={{ height: '60px', borderBottom: '2px solid #000', position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}></div>
                {days.map((day, i) => {
                    const slotDate = new Date(currentWeekStart);
                    slotDate.setDate(slotDate.getDate() + i);
                    const isToday = slotDate.toDateString() === new Date().toDateString();

                    return (
                        <div
                            key={day}
                            onClick={() => onDayHeaderClick(i)}
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
                                background: isToday ? '#000' : '#fff',
                                transition: 'background 0.2s',
                                position: 'sticky',
                                top: 0,
                                zIndex: 10,
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

                            const weekStartMs = new Date(currentWeekStart).setHours(0, 0, 0, 0);
                            const weekEndDate = new Date(currentWeekStart);
                            weekEndDate.setDate(weekEndDate.getDate() + 7);
                            const weekEndMs = weekEndDate.setHours(0, 0, 0, 0);

                            const slotSessions = sessions.filter((s: any) => {
                                if (s.startTime) {
                                    const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
                                    if (start.toDateString() !== slotDate.toDateString()) return false;
                                    
                                    const sessionTimeStr = start.toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                    }).replace(/\u202F/g, ' ');
                                    if (sessionTimeStr !== time) return false;
                                } else {
                                    if (s.day !== dayIndex || s.time !== time) return false;

                                    if (s.date) {
                                        const sessionMs = new Date(s.date).getTime();
                                        if (sessionMs < weekStartMs || sessionMs >= weekEndMs) return false;
                                    }
                                }

                                if (selectedTrainerId === 'all' || selectedTrainerId === 'my') return true;
                                return s.trainerId === selectedTrainerId;
                            });

                            const isBusyByOthers = isClient && selectedTrainerId !== 'all' && selectedTrainerId !== 'my' && busySlots.some((bs: any) => {
                                if (bs.trainerId !== selectedTrainerId || bs.time !== time) return false;
                                
                                if (!bs.date) return false;
                                const bsDateObj = new Date(bs.date);
                                if (
                                    bsDateObj.getFullYear() !== slotDate.getFullYear() ||
                                    bsDateObj.getMonth() !== slotDate.getMonth() ||
                                    bsDateObj.getDate() !== slotDate.getDate()
                                ) return false;

                                return !sessions.some((s: any) => s.id === bs.id);
                            });

                            const displaySessions = slotSessions.filter((s: any) => {
                                if (!isClient) return true;
                                if (s.client_ids) return s.client_ids.some((cid: string) => clientIds.includes(cid));
                                if (s.clients) return s.clients.some((c: any) => clientIds.includes(c.id));
                                return clientIds.includes(s.clientId);
                            });

                            const firstSession = slotSessions[0];
                            const activeService = firstSession ? services.find((sv: any) => sv.name === firstSession.serviceName) : null;
                            const hasRoom = firstSession && activeService && (firstSession.clients?.length || 1) < (activeService.max_capacity || 1);

                            const available = isTrainerAvailable(dayIndex, time) && !isPastLimit && (slotSessions.length === 0 || hasRoom) && !isBusyByOthers;
                            const showAsAvailable = selectedTrainerId === 'all' || selectedTrainerId === 'my' || available;

                            let baseBackgroundColor = showAsAvailable ? 'transparent' : '#fafafa';
                            if (isToday && showAsAvailable) {
                                baseBackgroundColor = '#f5f5f5';
                            }

                            return (
                                <div
                                    key={`${dayIndex}-${time}`}
                                    onClick={() => handleSlotClick(dayIndex, time)}
                                    className={`calendar-slot ${showAsAvailable ? 'available' : ''}`}
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
                                        cursor: displaySessions.length > 0 ? (selectedTrainerId === 'all' ? 'pointer' : 'default') : (showAsAvailable && !isTrainer ? 'pointer' : 'not-allowed'),
                                        backgroundColor: baseBackgroundColor,
                                        backgroundImage: displaySessions.length === 0 && !showAsAvailable && !isBusyByOthers
                                            ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, #e0e0e0 10px, #e0e0e0 20px)'
                                            : 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {displaySessions.length > 1 ? (
                                        <>
                                            {displaySessions.slice(0, 3).map((displaySession: any, idx: number) => {
                                                const matchService = services?.find((s: any) => s.name === displaySession.serviceName);
                                                const serviceColor = matchService?.color && matchService.color !== '#000000' && matchService.color !== '#000' ? matchService.color : '#444';
                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSessionClick(displaySession);
                                                        }}
                                                        style={{
                                                            height: '24px',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: '#000',
                                                            color: '#fff',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            borderLeft: `4px solid ${serviceColor}`,
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            cursor: 'pointer',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        {getSessionClientNames(displaySession)}
                                                    </div>
                                                );
                                            })}
                                            {displaySessions.length > 3 && (
                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textAlign: 'center', marginTop: '2px' }}>
                                                    + {displaySessions.length - 3} more
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        displaySessions.map((displaySession: any, idx: number) => {
                                            const matchService = services?.find((s: any) => s.name === displaySession.serviceName);
                                            const serviceColor = matchService?.color && matchService.color !== '#000000' && matchService.color !== '#000' ? matchService.color : '#444';
                                            
                                            return (
                                                <div
                                                    key={idx}
                                                    className="session-card"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSessionClick(displaySession);
                                                    }}
                                                    style={{
                                                        backgroundColor: '#000',
                                                        borderRadius: '4px',
                                                        padding: '8px',
                                                        color: '#fff',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        cursor: 'pointer',
                                                        flexShrink: 0,
                                                        borderLeft: `6px solid ${serviceColor}`
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                                                            {getSessionClientNames(displaySession)}
                                                            {displaySession.clients && displaySession.clients.length > 1 && (
                                                                <span style={{ marginLeft: '4px', opacity: 0.6, fontSize: '0.7rem' }}>
                                                                    ({displaySession.clients.length})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{displaySession.serviceName}</div>
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, marginTop: '4px' }}>{displaySession.trainerName}</div>
                                                </div>
                                            );
                                        })
                                    )}

                                    {isBusyByOthers && (
                                        <div
                                            style={{
                                                backgroundColor: '#000',
                                                borderRadius: '4px',
                                                padding: '8px',
                                                color: '#fff',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'not-allowed',
                                                flexShrink: 0,
                                                margin: 'auto 0'
                                            }}
                                        >
                                            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Booked</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </React.Fragment>

                ))}
            </div>
        </div>
    );
};
