import React from 'react';
import type { GridProps } from './WeekGrid';

export const ResourceGrid: React.FC<GridProps> = ({
    sessions,
    trainers,
    services,
    busySlots,
    offDays,
    currentWeekStart, // In Day view, we'll treat this as the 'active' day for now
    selectedTrainerId,
    clientIds,
    userId,
    isClient,
    isTrainer,
    profile,
    onSlotSelected,
    onSessionClick,
}) => {
    // 1. Time Slots & Basic Config
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

    const checkTrainerAvailable = (trainer: any, date: Date, time: string) => {
        const dayIndex = (date.getDay() + 6) % 7;
        const dayName = daysMap[dayIndex];
        const slotTime = convertTo24h(time);
        const dateStr = date.toISOString().split('T')[0];

        const isOff = offDays.some((od: any) => od.trainerId === trainer.id && od.date === dateStr);
        if (isOff) return false;

        const daySchedule = trainer.availability?.[dayName];
        if (!daySchedule || !daySchedule.active || !daySchedule.shifts) return false;

        return daySchedule.shifts.some((shift: any) => {
            const startTime = convertTo24h(shift.start);
            const endTime = convertTo24h(shift.end);
            return slotTime >= startTime && slotTime < endTime;
        });
    };

    // Filter active trainers based on selection
    const activeTrainers = isTrainer
        ? trainers.filter(t => t.id === profile?.trainerId)
        : (selectedTrainerId === 'all' || selectedTrainerId === 'my')
            ? trainers
            : trainers.filter(t => t.id === selectedTrainerId);

    // Date Constraint: The Resource grid focuses on a single day.
    // For now, we use currentWeekStart as the target Date. 
    // (If the container implements day-level navigation later, this will just read the active day)
    const activeDate = new Date(currentWeekStart);

    return (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: window.innerWidth <= 768 ? 0 : '0 40px' }}>
            <div 
                className="no-scrollbar"
                style={{
                display: 'grid',
                overflow: 'visible',
                overscrollBehaviorX: 'contain',
                // First column is Time (80px), then 1fr for each active trainer
                gridTemplateColumns: `80px repeat(${activeTrainers.length}, 1fr)`,
                minWidth: activeTrainers.length === 1 
                    ? 'auto' 
                    : (window.innerWidth <= 768 ? '800px' : '1000px'),
                borderLeft: '2px solid #000',
                borderRight: '2px solid #000'
            }}>
                {/* Top-Left Corner (Empty) */}
                <div style={{ height: '60px', borderBottom: '2px solid #000', position: 'sticky', top: 0, left: 0, zIndex: 20, background: '#fff' }}></div>
                
                {/* X-Axis: Trainer Headers */}
                {activeTrainers.map((trainer: any) => (
                    <div
                        key={trainer.id}
                        style={{
                            height: '60px',
                            borderBottom: '2px solid #000',
                            borderRight: '1px solid #eee',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#fafafa',
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                        }}
                    >
                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#000' }}>{trainer.name}</span>
                    </div>
                ))}

                {/* Y-Axis: Time Slots & Grid Cells */}
                {timeSlots.map(time => (
                    <React.Fragment key={time}>
                        {/* Row Header (Time) */}
                        <div style={{
                            minHeight: '80px', // slightly smaller than week view for density
                            borderBottom: '1px solid #eee',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#999',
                            borderRight: '2px solid #000',
                            position: 'sticky',
                            left: 0,
                            zIndex: 9,
                            background: '#fff'
                        }}>
                            {time}
                        </div>

                        {/* Cells for each trainer at this time */}
                        {activeTrainers.map((trainer: any) => {
                            // Fetch all sessions matching this day, time, and trainer
                            const slotSessions = sessions.filter((s: any) => {
                                // Enforce trainer match
                                if (s.trainerId !== trainer.id) return false;

                                // Time / Date match
                                if (s.startTime) {
                                    const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
                                    if (start.toDateString() !== activeDate.toDateString()) return false;

                                    // Compare numerically to avoid locale-sensitive string differences
                                    // e.g. "6:00 AM" vs "06:00 AM" depending on browser/OS
                                    const slotH = parseInt(time.split(':')[0], 10);
                                    const slotM = parseInt(time.split(':')[1], 10);
                                    const isPM = time.includes('PM');
                                    const normalH = (isPM && slotH !== 12) ? slotH + 12 : (!isPM && slotH === 12) ? 0 : slotH;
                                    if (start.getHours() !== normalH || start.getMinutes() !== slotM) return false;
                                } else {
                                    // Legacy match
                                    if (s.time !== time) return false;
                                    if (s.date) {
                                        const sessionDate = new Date(s.date);
                                        if (sessionDate.toDateString() !== activeDate.toDateString()) return false;
                                    }
                                }
                                return true;
                            });

                            // Privacy Check: Is it blocked by others?
                            const isBusyByOthers = isClient && !slotSessions.some(s => s.clients?.some((c:any) => clientIds.includes(c.id))) && busySlots.some((bs: any) => {
                                if (bs.trainerId !== trainer.id || bs.time !== time) return false;
                                if (!bs.date) return false;
                                const bsDateObj = new Date(bs.date);
                                return bsDateObj.toDateString() === activeDate.toDateString();
                            });

                            const isAvailable = checkTrainerAvailable(trainer, activeDate, time);
                            const isCellUnavailable = isBusyByOthers || !isAvailable;

                            // If cell is clicked, we pass dayIndex=0 since we are strictly looking at 'activeDate'
                            // The container's modal relies on dayIndex to map to the week. 
                            // Since activeDate is currentWeekStart, dayIndex is 0 relative to it.
                            const handleCellClick = () => {
                                const hasBlockedSession = slotSessions.some((s: any) => s.status === 'Blocked');
                                if (isCellUnavailable || (isClient && (hasBlockedSession || slotSessions.length > 0))) return;
                                
                                // To align with CalendarView's modal, we tell it we clicked day 0 (which maps to currentWeekStart)
                                onSlotSelected({
                                    day: 0, 
                                    time,
                                    trainerId: trainer.id,
                                    date: activeDate
                                });
                            };

                            const hasBlockedSession = slotSessions.some((s: any) => s.status === 'Blocked');

                            return (
                                <div
                                    key={`${trainer.id}-${time}`}
                                    onClick={handleCellClick}
                                    style={{
                                        borderBottom: '1px solid #eee',
                                        borderRight: '1px solid #eee',
                                        padding: '4px',
                                        minHeight: '80px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        cursor: hasBlockedSession
                                            ? (isClient ? 'not-allowed' : 'pointer')
                                            : (slotSessions.length > 0)
                                                ? (isClient ? 'default' : 'pointer')
                                                : ((!isCellUnavailable) ? 'pointer' : 'default'),
                                        backgroundColor: (isCellUnavailable || (isClient && hasBlockedSession)) ? '#fafafa' : 'transparent',
                                        backgroundImage: (isCellUnavailable || (isClient && hasBlockedSession))
                                            ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, #e0e0e0 10px, #e0e0e0 20px)'
                                            : 'none',
                                    }}
                                >
                                    {isBusyByOthers && slotSessions.length === 0 ? (
                                        <div style={{ margin: 'auto', fontSize: '0.8rem', fontWeight: 800, color: '#999' }}>Booked</div>
                                    ) : isCellUnavailable && slotSessions.length === 0 ? (
                                        null
                                    ) : (
                                        slotSessions.map((session: any, idx: number) => {
                                            const matchedService = services?.find(s => 
                                                (s.name && session.serviceType && s.name.toLowerCase().includes(session.serviceType.toLowerCase())) || 
                                                (session.serviceType && s.name && session.serviceType.toLowerCase().includes(s.name.toLowerCase()))
                                            );
                                            const chipColor = session.status === 'Blocked' ? '#6B7280' : (matchedService?.color || '#4B5563');
                                            
                                            const isLimitlessOpen = session.serviceName?.toLowerCase().includes('limitless open') || session.serviceType?.toLowerCase().includes('limitless open');
                                            const attendeesCount = session.clients?.length || 1;
                                            
                                            let isUserInSession = false;
                                            if (isClient) {
                                                isUserInSession = (session.client_ids && session.client_ids.some((cid: string) => clientIds.includes(cid))) ||
                                                                  (session.clients && session.clients.some((c: any) => clientIds.includes(c.id))) ||
                                                                  clientIds.includes(session.clientId) ||
                                                                  (session.uids && session.uids.includes(userId));
                                            }
 
                                            if (isClient && !isUserInSession) {
                                                let chipText = session.status === 'Blocked' ? 'Unavailable' : 'Booked';
                                                let chipCursor = 'not-allowed';
                                                let handleClick = (e: any) => { e.stopPropagation(); };
 
                                                if (session.status !== 'Blocked' && isLimitlessOpen && attendeesCount < 3) {
                                                    chipText = `Limitless Open (${attendeesCount}/3) - Join`;
                                                    chipCursor = 'pointer';
                                                    handleClick = (e: any) => {
                                                        e.stopPropagation();
                                                        onSlotSelected({
                                                            day: session.day || 0,
                                                            time: session.time,
                                                            trainerId: session.trainerId,
                                                            date: new Date(session.date || activeDate),
                                                            joinSessionId: session.id,
                                                            joinServiceName: session.serviceName,
                                                            joinTrainerName: session.trainerName
                                                        });
                                                    };
                                                }
 
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
                                                        onClick={handleClick}
                                                    >
                                                        <div
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
                                                                borderLeft: `4px solid ${chipColor}`,
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                cursor: chipCursor
                                                            }}
                                                        >
                                                            {chipText}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                             // Handle multiple clients in a single group session for trainers/admins or if user is in session
                                             const displayClients = session.status === 'Blocked'
                                                 ? [{ name: 'BLOCKED' }]
                                                 : (session.clients && Array.isArray(session.clients) 
                                                     ? session.clients 
                                                     : [{ name: session.clientName || 'Unknown' }]);
                                                
                                            const visibleClients = displayClients.slice(0, 3);
                                            const extraCount = displayClients.length - 3;

                                            return (
                                                <div 
                                                    key={idx} 
                                                    style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSessionClick(session);
                                                    }}
                                                >
                                                    {visibleClients.map((client: any, cIdx: number) => (
                                                        <div
                                                            key={cIdx}
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
                                                                borderLeft: `4px solid ${chipColor}`,
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {client.name}
                                                        </div>
                                                    ))}
                                                    {extraCount > 0 && (
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textAlign: 'center', marginTop: '2px' }}>
                                                            + {extraCount} more
                                                        </div>
                                                    )}
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
