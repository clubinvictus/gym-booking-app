import { useState, useEffect } from 'react';
import { X, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, writeBatch, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useConfirm } from '../ConfirmContext';
import { SITE_ID } from '../constants';

interface ConfirmOffDayModalProps {
    isOpen: boolean;
    onClose: () => void;
    trainerId: string;
    trainerName: string;
    clickedDate: Date;
    offDays: any[];
    onReschedule: (session: any) => void;
}

const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const generateDateRange = (startStr: string, endStr: string) => {
    const dates: string[] = [];
    const start = parseLocalDate(startStr);
    const end = parseLocalDate(endStr);

    const curr = new Date(start);
    while (curr <= end) {
        dates.push(getLocalDateString(curr));
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
};

export const ConfirmOffDayModal = ({
    isOpen,
    onClose,
    trainerId,
    trainerName,
    clickedDate,
    offDays,
    onReschedule
}: ConfirmOffDayModalProps) => {
    const { user, profile } = useAuth();
    const confirm = useConfirm();

    const [action, setAction] = useState<'add' | 'clear'>('add');
    const [mode, setMode] = useState<'single' | 'range'>('single');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const [bookedSessions, setBookedSessions] = useState<any[]>([]);
    const [affectedDaysCount, setAffectedDaysCount] = useState(0);

    const clickedDateStr = getLocalDateString(clickedDate);
    const isClickedDayAlreadyOff = offDays.some(od => od.trainerId === trainerId && od.date === clickedDateStr);

    // Initialize states on open
    useEffect(() => {
        if (isOpen) {
            const initialAction = isClickedDayAlreadyOff ? 'clear' : 'add';
            setAction(initialAction);
            setMode('single');
            setStartDate(clickedDateStr);
            setEndDate(clickedDateStr);
            setStep(1);
            setBookedSessions([]);
            setAffectedDaysCount(0);
        }
    }, [isOpen, clickedDateStr, isClickedDayAlreadyOff, trainerId]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        const startVal = mode === 'single' ? clickedDateStr : startDate;
        const endVal = mode === 'single' ? clickedDateStr : endDate;

        if (!startVal || !endVal) {
            alert('Please select both start and end dates.');
            return;
        }
        if (startVal > endVal) {
            alert('Start date cannot be after end date.');
            return;
        }

        setIsSaving(true);
        try {
            const dates = generateDateRange(startVal, endVal);

            // Fetch existing off-days in selected range
            const offDaysQuery = query(
                collection(db, 'off_days'),
                where('trainerId', '==', trainerId),
                where('date', '>=', startVal),
                where('date', '<=', endVal),
                where('siteId', '==', SITE_ID)
            );
            const offDaysSnap = await getDocs(offDaysQuery);

            const batch = writeBatch(db);

            if (action === 'add') {
                const existingDates = new Set(offDaysSnap.docs.map(doc => doc.data().date));
                let newDocsCount = 0;

                dates.forEach(dateStr => {
                    if (!existingDates.has(dateStr)) {
                        const newDocRef = doc(collection(db, 'off_days'));
                        batch.set(newDocRef, {
                            trainerId,
                            date: dateStr,
                            siteId: SITE_ID,
                            createdBy: user?.uid || 'unknown',
                            timestamp: new Date().toISOString()
                        });
                        newDocsCount++;
                    }
                });

                if (newDocsCount > 0) {
                    await batch.commit();
                }
                setAffectedDaysCount(newDocsCount);

                // Fetch sessions in range
                const q = query(
                    collection(db, 'sessions'),
                    where('trainerId', '==', trainerId),
                    where('date', '>=', startVal),
                    where('date', '<=', endVal),
                    where('siteId', '==', SITE_ID)
                );
                const sessionSnap = await getDocs(q);
                const sessionsList = sessionSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Sort sessions list by date/time
                sessionsList.sort((a: any, b: any) => {
                    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
                    if (dateDiff !== 0) return dateDiff;
                    return a.time.localeCompare(b.time);
                });

                if (sessionsList.length > 0) {
                    setBookedSessions(sessionsList);
                    setStep(2); // Transition to Resolve Conflicts step
                } else {
                    alert(`Successfully marked ${newDocsCount} day(s) as off-days.`);
                    onClose();
                }
            } else {
                // action is 'clear'
                let docsToDelete = 0;
                offDaysSnap.docs.forEach(docSnap => {
                    batch.delete(doc(db, 'off_days', docSnap.id));
                    docsToDelete++;
                });

                if (docsToDelete > 0) {
                    await batch.commit();
                }

                alert(`Successfully cleared off-day status for ${docsToDelete} day(s).`);
                onClose();
            }
        } catch (error: any) {
            console.error('Error updating off-days:', error);
            alert(`An error occurred while managing off-days: ${error.message || error}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelSession = async (session: any) => {
        const confirmed = await confirm({
            title: 'Cancel Session?',
            message: `Are you sure you want to cancel the session for ${session.clientName || 'Group'} at ${session.time}? This action cannot be undone.`,
            confirmLabel: 'Yes, Cancel',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            await deleteDoc(doc(db, 'sessions', session.id));

            // Log activity
            await addDoc(collection(db, 'activity_logs'), {
                action: 'cancelled',
                sessionDetails: {
                    clientName: session.clientName || session.clients?.map((c: any) => c.name).join(', ') || 'Group',
                    trainerName: session.trainerName,
                    serviceName: session.serviceName,
                    date: session.date,
                    time: session.time
                },
                performedBy: {
                    uid: profile?.uid || 'unknown',
                    name: profile?.name || 'Unknown User',
                    role: profile?.role || 'unknown'
                },
                timestamp: new Date().toISOString(),
                siteId: SITE_ID
            });

            alert('Session cancelled successfully.');
            setBookedSessions(prev => prev.filter(s => s.id !== session.id));
        } catch (error) {
            console.error('Error cancelling session:', error);
            alert('Failed to cancel session.');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(8px)',
            padding: '20px'
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: step === 1 ? '480px' : '650px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: window.innerWidth <= 768 ? '24px' : '40px',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000',
                boxShadow: '20px 20px 0 rgba(0,0,0,0.2)'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        right: '20px',
                        top: '20px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    <X size={24} />
                </button>

                {step === 1 ? (
                    <>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                            {action === 'add' ? 'CALL OFF-DAY(S)' : 'REMOVE OFF-DAY(S)'}
                        </h2>

                        <p style={{ fontWeight: 700, marginBottom: '20px', color: '#555' }}>
                            Trainer: <span style={{ color: '#000', fontWeight: 900 }}>{trainerName}</span>
                        </p>

                        {/* Action Selection Tabs (Only show toggles if we want to override default action) */}
                        <div style={{ display: 'flex', border: '2px solid #000', marginBottom: '24px' }}>
                            <button
                                onClick={() => setAction('add')}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: action === 'add' ? '#000' : '#fff',
                                    color: action === 'add' ? '#fff' : '#000',
                                    fontWeight: 800,
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                CALL OFF
                            </button>
                            <button
                                onClick={() => setAction('clear')}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: action === 'clear' ? '#000' : '#fff',
                                    color: action === 'clear' ? '#fff' : '#000',
                                    fontWeight: 800,
                                    border: 'none',
                                    borderLeft: '2px solid #000',
                                    cursor: 'pointer'
                                }}
                            >
                                CLEAR OFF
                            </button>
                        </div>

                        {/* Scope Mode Selection */}
                        <div style={{ display: 'flex', border: '2px solid #000', marginBottom: '24px' }}>
                            <button
                                onClick={() => setMode('single')}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: mode === 'single' ? '#000' : '#fff',
                                    color: mode === 'single' ? '#fff' : '#000',
                                    fontWeight: 800,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                SINGLE DAY
                            </button>
                            <button
                                onClick={() => setMode('range')}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: mode === 'range' ? '#000' : '#fff',
                                    color: mode === 'range' ? '#fff' : '#000',
                                    fontWeight: 800,
                                    border: 'none',
                                    borderLeft: '2px solid #000',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                DATE RANGE
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Date inputs conditional rendering */}
                            {mode === 'single' ? (
                                <div style={{ background: '#f9f9f9', padding: '16px', border: '2px solid #eee' }}>
                                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Selected Date
                                    </span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>
                                        {clickedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '16px', flexDirection: window.innerWidth <= 768 ? 'column' : 'row' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            style={{
                                                width: '100%',
                                                height: '46px',
                                                padding: '0 12px',
                                                border: '2px solid #000',
                                                borderRadius: 0,
                                                fontWeight: 800,
                                                fontSize: '0.95rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            style={{
                                                width: '100%',
                                                height: '46px',
                                                padding: '0 12px',
                                                border: '2px solid #000',
                                                borderRadius: 0,
                                                fontWeight: 800,
                                                fontSize: '0.95rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Submit Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                                <button
                                    onClick={handleConfirm}
                                    disabled={isSaving}
                                    className="button-primary"
                                    style={{
                                        width: '100%',
                                        height: '50px',
                                        fontSize: '1rem',
                                        background: action === 'add' ? '#ff4444' : '#000',
                                        borderColor: action === 'add' ? '#ff4444' : '#000',
                                        color: '#fff',
                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                        opacity: isSaving ? 0.7 : 1
                                    }}
                                >
                                    {isSaving ? 'PROCESSING...' : action === 'add' ? 'CONFIRM OFF-DAY(S)' : 'REMOVE OFF-DAY(S)'}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="button-secondary"
                                    style={{ width: '100%', height: '50px', fontSize: '1rem' }}
                                >
                                    CANCEL
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Step 2: Conflict Resolution list view */}
                        <header style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <AlertCircle size={28} color="#ff4444" />
                                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0 }}>
                                    Resolve Conflicts: {trainerName}
                                </h2>
                            </div>
                            <p className="text-muted" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                                Successfully called {affectedDaysCount} off-days. The following bookings conflict with the off-days. You can reschedule or cancel them now, or close this modal to resolve them later from the calendar.
                            </p>
                        </header>

                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            maxHeight: '380px',
                            overflowY: 'auto',
                            paddingRight: '4px',
                            marginBottom: '24px'
                        }}>
                            {bookedSessions.length > 0 ? (
                                bookedSessions.map((session) => {
                                    const dateObj = new Date(session.date);
                                    const formattedDate = dateObj.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric'
                                    });

                                    return (
                                        <div
                                            key={session.id}
                                            style={{
                                                padding: '16px',
                                                border: '2px solid #000',
                                                display: 'flex',
                                                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                                                justifyContent: 'space-between',
                                                alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                                                gap: '16px',
                                                background: '#fcfcfc'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '4px' }}>
                                                    {formattedDate} at {session.time} - {session.clientName || 'Group'}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>
                                                    {session.serviceName}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', width: window.innerWidth <= 768 ? '100%' : 'auto' }}>
                                                <button
                                                    onClick={() => onReschedule(session)}
                                                    className="button-secondary"
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        fontSize: '0.8rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <Edit2 size={14} />
                                                    Reschedule
                                                </button>
                                                <button
                                                    onClick={() => handleCancelSession(session)}
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        background: '#fff5f5',
                                                        color: '#f44336',
                                                        border: '2px solid #f44336',
                                                        fontWeight: 800,
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ padding: '32px', textAlign: 'center', background: '#f9f9f9', border: '2px dashed #ccc' }}>
                                    <p style={{ fontWeight: 700, margin: 0, color: '#4caf50' }}>All conflicts resolved successfully!</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="button-primary"
                            style={{
                                width: '100%',
                                padding: '14px',
                                fontSize: '1rem',
                                background: '#000',
                                border: '2px solid #000'
                            }}
                        >
                            {bookedSessions.length > 0 ? 'DONE (RESOLVE LATER)' : 'DONE'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
