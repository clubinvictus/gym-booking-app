import { useState, useEffect } from 'react';
import { X, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, writeBatch, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useConfirm } from '../ConfirmContext';
import { SITE_ID } from '../constants';

interface OffDaysRangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    trainers: any[];
    currentTrainerId: string;
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

export const OffDaysRangeModal = ({ isOpen, onClose, trainers, currentTrainerId, onReschedule }: OffDaysRangeModalProps) => {
    const { user, profile } = useAuth();
    const confirm = useConfirm();

    const [trainerId, setTrainerId] = useState('');
    const [action, setAction] = useState<'add' | 'clear'>('add');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const [isSaving, setIsSaving] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const [bookedSessions, setBookedSessions] = useState<any[]>([]);
    const [offDaysCount, setOffDaysCount] = useState(0);

    // Reset fields on open/close
    useEffect(() => {
        if (isOpen) {
            const defaultTrainer = currentTrainerId !== 'all' && currentTrainerId !== 'my' ? currentTrainerId : '';
            setTrainerId(defaultTrainer);
            setAction('add');
            
            const todayStr = getLocalDateString(new Date());
            setStartDate(todayStr);
            setEndDate(todayStr);
            setStep(1);
            setBookedSessions([]);
            setOffDaysCount(0);
        }
    }, [isOpen, currentTrainerId]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (!trainerId) {
            alert('Please select a trainer.');
            return;
        }
        if (!startDate || !endDate) {
            alert('Please select both start and end dates.');
            return;
        }
        if (startDate > endDate) {
            alert('Start date cannot be after end date.');
            return;
        }

        setIsSaving(true);
        try {
            const dates = generateDateRange(startDate, endDate);

            // Fetch existing off-days in range to prevent duplicate writes or identify deletes
            const offDaysQuery = query(
                collection(db, 'off_days'),
                where('trainerId', '==', trainerId),
                where('date', '>=', startDate),
                where('date', '<=', endDate),
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
                setOffDaysCount(newDocsCount);

                // Query booked sessions in range
                const q = query(
                    collection(db, 'sessions'),
                    where('trainerId', '==', trainerId),
                    where('date', '>=', startDate),
                    where('date', '<=', endDate),
                    where('siteId', '==', SITE_ID)
                );
                const sessionSnap = await getDocs(q);
                const sessionsList = sessionSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Sort in-memory by date and time
                sessionsList.sort((a: any, b: any) => {
                    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
                    if (dateDiff !== 0) return dateDiff;
                    return a.time.localeCompare(b.time);
                });

                if (sessionsList.length > 0) {
                    setBookedSessions(sessionsList);
                    setStep(2); // Go to Resolve Sessions view
                } else {
                    alert(`Successfully marked ${newDocsCount} days as off-days.`);
                    onClose();
                }
            } else {
                // Action is 'clear'
                let docsToDelete = 0;
                offDaysSnap.docs.forEach(docSnap => {
                    batch.delete(doc(db, 'off_days', docSnap.id));
                    docsToDelete++;
                });

                if (docsToDelete > 0) {
                    await batch.commit();
                }

                alert(`Successfully cleared off-day status for ${docsToDelete} days.`);
                onClose();
            }
        } catch (error) {
            console.error('Error executing off-days range update:', error);
            alert('An error occurred while saving off-days.');
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

    const trainerName = trainers.find(t => t.id === trainerId)?.name || 'Trainer';

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
            zIndex: 1000,
            backdropFilter: 'blur(8px)',
            padding: '20px'
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: step === 1 ? '480px' : '650px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: isMobileView() ? '24px' : '40px',
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
                            MANAGE OFF-DAYS
                        </h2>

                        {/* Action Selection Tabs */}
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
                                CALL OFF-DAYS
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
                                CLEAR OFF-DAYS
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Trainer Selection */}
                            <div>
                                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>
                                    Trainer
                                </label>
                                <select
                                    value={trainerId}
                                    onChange={(e) => setTrainerId(e.target.value)}
                                    style={{
                                        width: '100%',
                                        height: '46px',
                                        padding: '0 12px',
                                        border: '2px solid #000',
                                        borderRadius: 0,
                                        fontWeight: 800,
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        background: '#fff'
                                    }}
                                >
                                    <option value="">Select Trainer...</option>
                                    {trainers.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Fields Row */}
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

                            {/* Action Buttons */}
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
                                    {isSaving ? 'PROCESSING...' : action === 'add' ? 'CALL OFF-DAYS' : 'CLEAR OFF-DAYS'}
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
                        {/* Step 2: Resolve Bookings View */}
                        <header style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <AlertCircle size={28} color="#ff4444" />
                                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0 }}>
                                    Resolve Conflicts: {trainerName}
                                </h2>
                            </div>
                            <p className="text-muted" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                                Successfully called {offDaysCount} off-days. The following bookings conflict with the off-days. You can reschedule or cancel them now, or close this modal to resolve them later from the calendar.
                            </p>
                        </header>

                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            maxHeight: '400px',
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

function isMobileView() {
    return window.innerWidth <= 768;
}
