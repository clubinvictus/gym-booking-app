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
    onSlotSelected: (slotData: { day: number; time: string; trainerId: string | null; date: Date; joinSessionId?: string }) => void;
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
    const isMobile = window.innerWidth <= 768;
    const daysToShow = isMobile ? 3 : 7;
    
    // Generate the visible days based on currentWeekStart
    const visibleDays = Array.from({ length: daysToShow }).map((_, i) => {
        const d = new Date(currentWeekStart);
        d.setDate(currentWeekStart.getDate() + i);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return {
            name: dayNames[d.getDay()],
            date: d.getDate(),
            fullDate: d,
            // dayIndex for our internal logic (0=Mon, 1=Tue, ..., 6=Sun)
            dayIndex: (d.getDay() + 6) % 7
        };
    });

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

    const isTrainerAvailable = (dayIndex: number, dateStr: string, time: string) => {
        const dayName = daysMap[dayIndex];
        const slotTime = convertTo24h(time);

        const activeTrainers = (selectedTrainerId === 'all' || selectedTrainerId === 'my')
            ? trainers
            : trainers.filter(t => t.id === selectedTrainerId);

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

    const handleSlotClick = (dayIndex: number, slotDate: Date, time: string) => {
        const effectiveTrainerId = isTrainer ? profile?.trainerId : ((selectedTrainerId === 'all' || selectedTrainerId === 'my') ? null : selectedTrainerId);
        const isPastLimit = isClient && slotDate > limitDate;
        const dateStr = slotDate.toISOString().split('T')[0];

        let available = isTrainerAvailable(dayIndex, dateStr, time) && !isPastLimit;

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

            const isBusy = busySlots.some((bs: any) => {
                const bsDate = bs.date ? bs.date.split('T')[0] : '';
                return bs.trainerId === selectedTrainerId && bsDate === dateStr && bs.time === time;
            });
            if (isBusy) available = false;
        }

        if (available && !isTrainer) {
            onSlotSelected({ day: dayIndex, time, trainerId: effectiveTrainerId, date: slotDate });
        }
    };

    return (
        <div 
            id="calendar-grid-container"
            style={{
                flex: 1, 
                overflowX: 'hidden', 
                overflowY: 'auto', 
                touchAction: 'pan-y',
                padding: isMobile ? '0 8px' : '0 40px' 
            }}
        >
            <div style={{
                display: 'grid',
                gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)`,
                width: '100%',
                borderLeft: '2px solid #000',
                borderRight: '2px solid #000'
            }}>
                {/* Sticky Day Header Row */}
                <div style={{ height: '60px', borderBottom: '2px solid #000', position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}></div>
                {visibleDays.map((day) => {
                    const isToday = day.fullDate.toDateString() === new Date().toDateString();

                    return (
                        <div
                            key={day.fullDate.toISOString()}
                            onClick={() => onDayHeaderClick(day.dayIndex)}
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
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isToday ? '#fff' : '#666' }}>{day.name.toUpperCase()}</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isToday ? '#fff' : 'inherit' }}>{day.date}</span>
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
                        {visibleDays.map((day) => {
                            const { dayIndex, fullDate: slotDate } = day;
                            const isPastLimit = isClient && slotDate > limitDate;
                            const isToday = slotDate.toDateString() === new Date().toDateString();
                            const dateStr = slotDate.toISOString().split('T')[0];

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
                                        const sessionDateStr = new Date(s.date).toISOString().split('T')[0];
                                        if (sessionDateStr !== dateStr) return false;
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

                                const isLimitlessOpen = s.serviceName?.toLowerCase().includes('limitless open') || s.serviceType?.toLowerCase().includes('limitless open');
                                
                                const isMySession = 
                                    clientIds.includes(s.clientId) || 
                                    (s.client_ids && s.client_ids.some((cid: string) => clientIds.includes(cid))) ||
                                    (s.clients && s.clients.some((c: any) => clientIds.includes(c.id))) ||
                                    (s.attendees && s.attendees.some((aid: string) => clientIds.includes(aid)));

                                // If "My Calendar" view is selected, only show my sessions + limitless open
                                if (selectedTrainerId === 'my') {
                                    if (isLimitlessOpen) return true;
                                    return isMySession;
                                }

                                // If a specific trainer is selected (or "All"), show ALL their sessions
                                // The chip rendering logic below will handle masking "Booked" vs "Details"
                                return true;
                            });

                            const firstSession = slotSessions[0];
                            const activeService = firstSession ? services.find((sv: any) => sv.name === firstSession.serviceName) : null;
                            const hasRoom = firstSession && activeService && (firstSession.clients?.length || 1) < (activeService.max_capacity || 1);

                            const available = isTrainerAvailable(dayIndex, dateStr, time) && !isPastLimit && (slotSessions.length === 0 || hasRoom) && !isBusyByOthers;
                            const showAsAvailable = selectedTrainerId === 'all' || selectedTrainerId === 'my' || available;

                            let baseBackgroundColor = showAsAvailable ? 'transparent' : '#fafafa';
                            if (isToday && showAsAvailable) {
                                baseBackgroundColor = '#f5f5f5';
                            }

                            return (
                                <div
                                    key={`${dayIndex}-${time}`}
                                    onClick={() => handleSlotClick(dayIndex, slotDate, time)}
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
                                                const matchService = services?.find((s: any) => 
                                                    s.name?.trim().toLowerCase() === displaySession.serviceName?.trim().toLowerCase() ||
                                                    s.name?.trim().toLowerCase() === displaySession.serviceType?.trim().toLowerCase()
                                                );
                                                const serviceColor = matchService?.color && matchService.color !== '#000000' && matchService.color !== '#000' ? matchService.color : '#4B5563';
                                                
                                                const isLimitlessOpen = displaySession.serviceName?.toLowerCase().includes('limitless open') || displaySession.serviceType?.toLowerCase().includes('limitless open');
                                                const attendeesCount = displaySession.clients?.length || 1;
                                                
                                                let isUserInSession = false;
                                                if (isClient) {
                                                    isUserInSession = 
                                                        clientIds.includes(displaySession.clientId) || 
                                                        (displaySession.client_ids && displaySession.client_ids.some((cid: string) => clientIds.includes(cid))) ||
                                                        (displaySession.clients && displaySession.clients.some((c: any) => clientIds.includes(c.id))) ||
                                                        (displaySession.attendees && displaySession.attendees.some((aid: string) => clientIds.includes(aid)));
                                                }

                                                let chipBg = '#000';
                                                let chipCursor = 'pointer';
                                                let chipText = getSessionClientNames(displaySession);
                                                let handleClick = (e: any) => {
                                                    e.stopPropagation();
                                                    onSessionClick(displaySession);
                                                };

                                                if (isClient && !isUserInSession) {
                                                    if (isLimitlessOpen && attendeesCount < 3) {
                                                        chipBg = serviceColor;
                                                        chipText = `Limitless Open (${attendeesCount}/3)`;
                                                        handleClick = (e: any) => {
                                                            e.stopPropagation();
                                                            onSlotSelected({
                                                                day: displaySession.day,
                                                                time: displaySession.time,
                                                                trainerId: displaySession.trainerId,
                                                                date: displaySession.date,
                                                                joinSessionId: displaySession.id
                                                            });
                                                        };
                                                    } else {
                                                        chipBg = '#000';
                                                        chipText = isLimitlessOpen && attendeesCount >= 3 ? 'Full' : 'Booked';
                                                        chipCursor = 'not-allowed';
                                                        handleClick = (e: any) => { e.stopPropagation(); }; // unclickable
                                                    }
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={handleClick}
                                                        style={{
                                                            height: '24px',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: chipBg,
                                                            color: '#fff',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            borderLeft: `4px solid ${serviceColor}`,
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            cursor: chipCursor,
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        {chipText}
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
                                            const matchService = services?.find((s: any) => 
                                                s.name?.trim().toLowerCase() === displaySession.serviceName?.trim().toLowerCase() ||
                                                s.name?.trim().toLowerCase() === displaySession.serviceType?.trim().toLowerCase()
                                            );
                                            const serviceColor = matchService?.color && matchService.color !== '#000000' && matchService.color !== '#000' ? matchService.color : '#4B5563';
                                            
                                                const isLimitlessOpen = displaySession.serviceName?.toLowerCase().includes('limitless open') || displaySession.serviceType?.toLowerCase().includes('limitless open');
                                                const attendeesCount = displaySession.clients?.length || 1;
                                                
                                                let isUserInSession = false;
                                                if (isClient) {
                                                    isUserInSession = 
                                                        clientIds.includes(displaySession.clientId) || 
                                                        (displaySession.client_ids && displaySession.client_ids.some((cid: string) => clientIds.includes(cid))) ||
                                                        (displaySession.clients && displaySession.clients.some((c: any) => clientIds.includes(c.id))) ||
                                                        (displaySession.attendees && displaySession.attendees.some((aid: string) => clientIds.includes(aid)));
                                                }

                                                let chipBg = '#000';
                                                let chipCursor = 'pointer';
                                                let chipTextPrimary = getSessionClientNames(displaySession);
                                                let chipTextSecondary = displaySession.serviceName;
                                                let handleClick = (e: any) => {
                                                    e.stopPropagation();
                                                    onSessionClick(displaySession);
                                                };

                                                if (isClient && !isUserInSession) {
                                                    if (isLimitlessOpen && attendeesCount < 3) {
                                                        chipBg = serviceColor;
                                                        chipTextPrimary = `Limitless Open (${attendeesCount}/3)`;
                                                        chipTextSecondary = 'Click to Join';
                                                        handleClick = (e: any) => {
                                                            e.stopPropagation();
                                                            onSlotSelected({
                                                                day: displaySession.day,
                                                                time: displaySession.time,
                                                                trainerId: displaySession.trainerId,
                                                                date: displaySession.date,
                                                                joinSessionId: displaySession.id
                                                            });
                                                        };
                                                    } else {
                                                        chipBg = '#000';
                                                        chipTextPrimary = isLimitlessOpen && attendeesCount >= 3 ? 'Full' : 'Booked';
                                                        chipTextSecondary = '';
                                                        chipCursor = 'not-allowed';
                                                        handleClick = (e: any) => { e.stopPropagation(); }; // unclickable
                                                    }
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="session-card"
                                                        onClick={handleClick}
                                                        style={{
                                                            backgroundColor: chipBg,
                                                            borderRadius: '4px',
                                                            padding: '8px',
                                                            color: '#fff',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            cursor: chipCursor,
                                                            flexShrink: 0,
                                                            borderLeft: `6px solid ${serviceColor}`
                                                        }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                                                                {chipTextPrimary}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                                                {chipTextSecondary}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                        })
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
