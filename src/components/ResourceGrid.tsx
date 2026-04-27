import React from 'react';
import type { GridProps } from './WeekGrid';

export const ResourceGrid: React.FC<GridProps> = ({
    sessions,
    trainers,
    services,
    busySlots,
    currentWeekStart, // In Day view, we'll treat this as the 'active' day for now
    selectedTrainerId,
    clientIds,
    isClient,
    isTrainer,
    onSlotSelected,
    onSessionClick,
}) => {
    // 1. Time Slots & Basic Config
    const timeSlots = [
        '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM',
        '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM'
    ];

    // Filter active trainers based on selection
    const activeTrainers = (selectedTrainerId === 'all' || selectedTrainerId === 'my')
        ? trainers
        : trainers.filter(t => t.id === selectedTrainerId);

    // Date Constraint: The Resource grid focuses on a single day.
    // For now, we use currentWeekStart as the target Date. 
    // (If the container implements day-level navigation later, this will just read the active day)
    const activeDate = new Date(currentWeekStart);

    return (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: window.innerWidth <= 768 ? '0 16px' : '0 40px' }}>
            <div 
                className="no-scrollbar"
                style={{
                display: 'grid',
                overflowX: 'auto',
                overscrollBehaviorX: 'contain',
                // First column is Time (80px), then 1fr for each active trainer
                gridTemplateColumns: `80px repeat(${activeTrainers.length}, 1fr)`,
                minWidth: window.innerWidth <= 768 ? '800px' : '1000px',
                borderLeft: '2px solid #000',
                borderRight: '2px solid #000'
            }}>
                {/* Top-Left Corner (Empty) */}
                <div style={{ height: '60px', borderBottom: '2px solid #000', position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}></div>
                
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
                            borderRight: '2px solid #000'
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
                                    
                                    const sessionTimeStr = start.toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                    }).replace(/\u202F/g, ' ');
                                    if (sessionTimeStr !== time) return false;
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

                            // If cell is clicked, we pass dayIndex=0 since we are strictly looking at 'activeDate'
                            // The container's modal relies on dayIndex to map to the week. 
                            // Since activeDate is currentWeekStart, dayIndex is 0 relative to it.
                            const handleCellClick = () => {
                                if (isTrainer) return; // Trainers can't book
                                if (isBusyByOthers) return;
                                
                                // To align with CalendarView's modal, we tell it we clicked day 0 (which maps to currentWeekStart)
                                onSlotSelected({
                                    day: 0, 
                                    time,
                                    trainerId: trainer.id,
                                    date: activeDate
                                });
                            };

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
                                        cursor: (slotSessions.length > 0 || !isTrainer) ? 'pointer' : 'default',
                                        backgroundColor: isBusyByOthers ? '#fafafa' : 'transparent',
                                        backgroundImage: isBusyByOthers 
                                            ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, #e0e0e0 10px, #e0e0e0 20px)'
                                            : 'none',
                                    }}
                                >
                                    {isBusyByOthers && slotSessions.length === 0 ? (
                                        <div style={{ margin: 'auto', fontSize: '0.8rem', fontWeight: 800, color: '#999' }}>Booked</div>
                                    ) : (
                                        slotSessions.map((session: any, idx: number) => {
                                            const matchedService = services?.find((s: any) => s.name === session.serviceType || s.name === session.serviceName);
                                            const chipColor = matchedService?.color || '#4B5563';
                                            console.log('Chip Debug:', { service: session.serviceType || session.serviceName, color: chipColor });
                                            
                                            const isLimitlessOpen = session.serviceName?.toLowerCase().includes('limitless open') || session.serviceType?.toLowerCase().includes('limitless open');
                                            const attendeesCount = session.clients?.length || 1;
                                            
                                            let isUserInSession = false;
                                            if (isClient) {
                                                isUserInSession = (session.client_ids && session.client_ids.some((cid: string) => clientIds.includes(cid))) ||
                                                                  (session.clients && session.clients.some((c: any) => clientIds.includes(c.id))) ||
                                                                  clientIds.includes(session.clientId);
                                            }
 
                                            if (isClient && !isUserInSession) {
                                                let chipText = 'Booked';
                                                let chipCursor = 'not-allowed';
                                                let handleClick = (e: any) => { e.stopPropagation(); };
 
                                                if (isLimitlessOpen && attendeesCount < 3) {
                                                    chipText = `Limitless Open (${attendeesCount}/3) - Join`;
                                                    chipCursor = 'pointer';
                                                    handleClick = (e: any) => {
                                                        e.stopPropagation();
                                                        onSlotSelected({
                                                            day: session.day || 0,
                                                            time: session.time,
                                                            trainerId: session.trainerId,
                                                            date: new Date(session.date || activeDate),
                                                            joinSessionId: session.id
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
                                            const displayClients = session.clients && Array.isArray(session.clients) 
                                                ? session.clients 
                                                : [{ name: session.clientName || 'Unknown' }];
                                                
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
