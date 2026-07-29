import { useState, useEffect, useRef } from 'react';
import { X, Clock, User, Briefcase, Calendar as CalendarIcon, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { db, functions } from '../firebase';
import { doc, deleteDoc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../AuthContext';
import { useConfirm } from '../ConfirmContext';
import { useFirestore } from '../hooks/useFirestore';
import { SITE_ID } from '../constants';

const getWeekdaysFromRecurringDetails = (details: string, currentSessionDay: number): { dayNum: number, name: string }[] => {
    const daysMap = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    if (!details) {
        return [{ dayNum: currentSessionDay, name: dayNames[currentSessionDay] || 'Selected Day' }];
    }

    if (details.toLowerCase() === 'daily') {
        return daysMap.map((_, idx) => ({ dayNum: idx, name: dayNames[idx] }));
    }

    if (details.startsWith('Weekly on ')) {
        const daysPart = details.replace('Weekly on ', '');
        const dayNamesList = daysPart.split(', ').map(d => d.trim().toLowerCase());
        const result: { dayNum: number, name: string }[] = [];
        
        daysMap.forEach((name, idx) => {
            if (dayNamesList.includes(name)) {
                result.push({
                    dayNum: idx,
                    name: dayNames[idx]
                });
            }
        });
        return result;
    }

    return [{ dayNum: currentSessionDay, name: dayNames[currentSessionDay] || 'Selected Day' }];
};

interface SessionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: any;
    onDelete: (sessionId: string) => void;
    onReschedule: (session: any) => void;
}

export const SessionDetailModal = ({ isOpen, onClose, session, onDelete, onReschedule }: SessionDetailModalProps) => {
    const confirm = useConfirm();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [deleteScope, setDeleteScope] = useState<'single' | 'future'>('single');
    const { profile, user } = useAuth();
    const isTrainer = profile?.role === 'trainer';
    const isAdmin = profile?.role === 'admin';
    const isManager = profile?.role === 'manager';
    const isStaff = isAdmin || isManager || isTrainer;
    const isClient = profile?.role === 'client';
    const isLimitlessOpen = session?.serviceName?.toLowerCase().includes('limitless open') || session?.serviceType?.toLowerCase().includes('limitless open');
    
    const [targetClientId, setTargetClientId] = useState<string | undefined>(undefined);
    const [isAddingClient, setIsAddingClient] = useState(false);
    const [newClientId, setNewClientId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [addScope, setAddScope] = useState<'single' | 'future'>('single');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch data for capacity limits and client list
    const { data: services } = useFirestore<any>('services');
    const { data: clients } = useFirestore<any>('clients', [], !isStaff);

    // Compute Capacity
    const sessionService = services.find((s: any) => s.id === session?.serviceId);
    const maxCapacity = sessionService?.max_capacity || 1;
    const currentCount = session?.clients?.length || 1;
    const hasCapacity = currentCount < maxCapacity && isStaff;

    // Reset state when modal opens/closes or session changes
    useEffect(() => {
        if (isOpen) {
            setIsDeleting(false);
            setIsProcessing(false);
            setDeleteScope('single');
            setIsAddingClient(false);
            setNewClientId('');
            setSearchQuery('');
            setShowDropdown(false);
            setAddScope('single');
            
            const initialDays = getWeekdaysFromRecurringDetails(session?.recurringDetails || '', session?.day || 0);
            setSelectedWeekdays(initialDays.map(d => d.dayNum));
        }
        // Deliberately [isOpen] only, not [isOpen, session] — session is a live Firestore-synced
        // object, so including it here meant a real-time update arriving mid-delete (e.g. this
        // trigger's own busySlotSynced write) would re-run this effect and silently reset
        // isDeleting/isProcessing, dropping the user back to the start of the delete flow.
    }, [isOpen]);

    const toggleWeekday = (dayNum: number) => {
        setSelectedWeekdays(prev => 
            prev.includes(dayNum) 
                ? prev.filter(d => d !== dayNum) 
                : [...prev, dayNum]
        );
    };

    if (!isOpen || !session) return null;

    const confirmDelete = async (clientId?: string) => {
        setIsProcessing(true);

        const logActivity = async (isRecurring: boolean, removedClientId?: string) => {
            try {
                const removedClient = session.clients?.find((c: any) => c.id === removedClientId);
                await addDoc(collection(db, 'activity_logs'), {
                    action: session?.status === 'Blocked' ? 'unblocked' : 'cancelled',
                    isRecurring,
                    sessionDetails: {
                        clientName: removedClientId ? (removedClient?.name || 'Unknown') : (session.clients?.[0]?.name || session.clientName),
                        trainerName: session.trainerName,
                        serviceName: session.serviceName,
                        date: session.date,
                        time: session.time,
                        recurringDetails: session.recurringDetails || null
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

        if (deleteScope === 'future' && session.seriesId) {
            try {
                // Explicit Intent Flag: Inform backend this is a bulk operation before deleting
                await updateDoc(doc(db, 'sessions', session.id), { deletionIntent: 'bulk' });

                // Retires the rule from this occurrence onward and trims its materialized docs,
                // bounded to whatever's actually materialized (the rolling window) rather than
                // the old unbounded `where('seriesId','==',...)` scan (see functions/index.js —
                // cancelRecurringSeriesFuture).
                const cancelRecurringSeriesFuture = httpsCallable(functions, 'cancelRecurringSeriesFuture');
                await cancelRecurringSeriesFuture({
                    seriesId: session.seriesId,
                    siteId: SITE_ID,
                    fromDateISO: session.date,
                    clientId: clientId || null
                });

                await logActivity(true, clientId);
                onDelete(session.id);
                onClose();
            } catch (err: any) {
                console.error('Error deleting series:', err);
                alert('Failed to delete series. Please try again.');
                setIsProcessing(false);
            }
        } else {
            // Single delete/removal
            try {
                if (session.seriesId) {
                    // Deletes (or detaches this client from) the occurrence, and atomically
                    // records the date in the rule's exceptions so a scheduled materializer
                    // run can't regenerate it (see functions/index.js — deleteRecurringOccurrence).
                    const deleteRecurringOccurrence = httpsCallable(functions, 'deleteRecurringOccurrence');
                    await deleteRecurringOccurrence({
                        sessionId: session.id,
                        seriesId: session.seriesId,
                        dateISO: session.date,
                        clientId: clientId || null
                    });
                } else if (clientId && session.clients && session.clients.length > 1) {
                    const updatedClients = session.clients.filter((c: any) => c.id !== clientId);
                    const newClientIds = Array.from(new Set(updatedClients.map((c: any) => c.id))).filter(Boolean) as string[];
                    await updateDoc(doc(db, 'sessions', session.id), {
                        clients: updatedClients,
                        clientIds: newClientIds
                    });
                } else {
                    await deleteDoc(doc(db, 'sessions', session.id));
                }
                await logActivity(false, clientId);
                onDelete(session.id);
                onClose();
            } catch (err: any) {
                console.error('Error deleting session:', err);
                alert('Failed to delete session. Please try again.');
                setIsProcessing(false);
            }
        }
    };

    const confirmAddClient = async () => {
        if (!newClientId) return;
        setIsProcessing(true);
        try {
            const clientToAdd = clients.find((c: any) => c.id === newClientId);
            if (!clientToAdd) throw new Error('Client not found');

            const clientObj = { 
                id: clientToAdd.id, 
                name: clientToAdd.name, 
                email: clientToAdd.email || '', 
                phone: clientToAdd.phone || '' 
            };

            if (addScope === 'future' && session.seriesId) {
                // Creates a new sibling recurring_series rule for the added client (mirroring
                // the target series' trainer/time/end-date) and materializes it immediately,
                // instead of batch-mutating the target series' own documents directly (see
                // functions/index.js — addClientToRecurringSeries). This is a real rule
                // creation, so the added client now gets a WhatsApp confirmation — previously
                // this path was an `isUpdate`, which onSessionWritten's recurring branch never
                // sent a notification for at all.
                const addClientToRecurringSeries = httpsCallable(functions, 'addClientToRecurringSeries');
                await addClientToRecurringSeries({
                    siteId: SITE_ID,
                    targetSeriesId: session.seriesId,
                    fromDateISO: session.date,
                    clientId: clientToAdd.id,
                    clientName: clientToAdd.name,
                    clientEmail: clientToAdd.email || null,
                    clientPhone: clientToAdd.phone || null,
                    clientUid: clientToAdd.uid || null,
                    selectedDays: selectedWeekdays,
                    createdBy: profile?.name || 'Unknown User'
                });

                alert('Client added to future sessions successfully!');
            } else {
                // Single booking
                const updatedClients = [...(session.clients || []), clientObj];
                const newClientIds = Array.from(new Set(updatedClients.map(c => c.id))).filter(Boolean) as string[];

                await updateDoc(doc(db, 'sessions', session.id), {
                    clients: updatedClients,
                    clientIds: newClientIds,
                    client_ids: newClientIds,
                    clientId: newClientIds[0] || null
                });

                // Log activity
                await addDoc(collection(db, 'activity_logs'), {
                    action: 'booked',
                    isRecurring: false,
                    sessionDetails: {
                        clientName: clientToAdd.name,
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

                alert('Client added to session successfully!');
            }

            onClose();
        } catch (err) {
            console.error('Error adding client to session:', err);
            alert('Failed to add client to session.');
        } finally {
            setIsProcessing(false);
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
                width: '100%',
                maxWidth: '450px',
                padding: '32px',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000'
            }}>
                <button
                    onClick={onClose}
                    disabled={isProcessing}
                    style={{
                        position: 'absolute',
                        right: '20px',
                        top: '20px',
                        background: 'transparent',
                        border: 'none',
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        opacity: isProcessing ? 0.5 : 1
                    }}
                >
                    <X size={24} />
                </button>

                {isDeleting ? (
                    <div>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px', color: '#ff4444' }}>
                            {session?.status === 'Blocked' ? 'Unblock Slot' : 'Delete Options'}
                        </h2>
                        <p className="text-muted" style={{ marginBottom: '24px' }}>
                            {session?.status === 'Blocked'
                                ? 'Are you sure you want to unblock this slot?'
                                : (session.seriesId ? 'Please select how you want to delete this recurring appointment.' : 'Are you sure you want to delete this session?')}
                        </p>

                        {session.seriesId && (
                            <div style={{ padding: '16px', background: '#f5f5f5', border: '2px solid #000', marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontWeight: 800, marginBottom: '12px', fontSize: '0.8rem', color: '#666' }}>DELETION SCOPE</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                                        <input
                                            type="radio"
                                            name="deleteScope"
                                            value="single"
                                            checked={deleteScope === 'single'}
                                            onChange={() => setDeleteScope('single')}
                                            style={{ width: '20px', height: '20px', accentColor: '#000' }}
                                        />
                                        Just this event
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                                        <input
                                            type="radio"
                                            name="deleteScope"
                                            value="future"
                                            checked={deleteScope === 'future'}
                                            onChange={() => setDeleteScope('future')}
                                            style={{ width: '20px', height: '20px', accentColor: '#000' }}
                                        />
                                        This and future events
                                    </label>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => setIsDeleting(false)}
                                className="button-secondary"
                                style={{ flex: 1, height: '54px' }}
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={async () => {
                                    const confirmed = await confirm({
                                        title: session?.status === 'Blocked' ? 'Unblock Slot?' : 'Delete Session?',
                                        message: session?.status === 'Blocked'
                                            ? 'Are you sure you want to unblock this slot? This will make it available for bookings again.'
                                            : (deleteScope === 'future' 
                                                ? 'Are you sure you want to delete this and all future sessions in the series? This action cannot be undone.'
                                                : 'Are you sure you want to delete this session? This action cannot be undone.'),
                                        confirmLabel: session?.status === 'Blocked' ? 'Yes, Unblock' : 'Yes, Delete',
                                        type: session?.status === 'Blocked' ? 'warning' : 'danger'
                                    });

                                    if (confirmed) {
                                        await confirmDelete(targetClientId);
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    height: '54px',
                                    background: '#000',
                                    color: '#fff',
                                    border: 'none',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}
                            >
                                {session?.status === 'Blocked' ? 'UNBLOCK' : 'DELETE'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Session Details</h2>
                            {sessionService && (
                                <div style={{ 
                                    background: hasCapacity ? '#e6f4ea' : '#fce8e6', 
                                    color: hasCapacity ? '#137333' : '#c5221f',
                                    padding: '4px 8px', 
                                    borderRadius: '4px', 
                                    fontSize: '0.8rem', 
                                    fontWeight: 800,
                                    border: `1px solid ${hasCapacity ? '#137333' : '#c5221f'}`
                                }}>
                                    {currentCount} / {maxCapacity} Booked
                                </div>
                            )}
                        </div>
                        <p className="text-muted" style={{ marginBottom: '32px' }}>Review or modify this booking</p>

                        {session?.status === 'Blocked' && (
                            <div style={{
                                padding: '16px',
                                background: '#fce8e6',
                                border: '2px solid #c5221f',
                                color: '#c5221f',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                marginBottom: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                This slot is BLOCKED. Clients cannot book this slot.
                            </div>
                        )}

                        {isAddingClient ? (
                            <div style={{ padding: '20px', background: '#f5f5f5', border: '2px solid #000', marginBottom: '32px' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Add Client to Session</h3>
                                
                                <div style={{ marginBottom: '20px', position: 'relative' }} ref={dropdownRef}>
                                    <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.8rem', color: '#666' }}>SELECT CLIENT</label>
                                    <input
                                        type="text"
                                        placeholder="Search and select client..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSearchQuery(val);
                                            setShowDropdown(true);
                                            if (!val) {
                                                setNewClientId('');
                                            } else {
                                                const selectedClient = clients.find((c: any) => c.id === newClientId);
                                                if (selectedClient && selectedClient.name !== val) {
                                                    setNewClientId('');
                                                }
                                            }
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                        style={{ 
                                            width: '100%', 
                                            padding: '12px', 
                                            border: '2px solid #000', 
                                            fontSize: '1rem', 
                                            fontWeight: 600,
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    {showDropdown && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            backgroundColor: '#fff',
                                            border: '2px solid #000',
                                            borderTop: 'none',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            zIndex: 1000,
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                                            boxSizing: 'border-box'
                                        }}>
                                            {clients
                                                .filter((c: any) => !session.clients?.some((sc: any) => sc.id === c.id))
                                                .filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                .sort((a: any, b: any) => a.name.localeCompare(b.name))
                                                .length > 0 ? (
                                                    clients
                                                        .filter((c: any) => !session.clients?.some((sc: any) => sc.id === c.id))
                                                        .filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                                                        .map((c: any) => (
                                                            <div
                                                                key={c.id}
                                                                onClick={() => {
                                                                    setNewClientId(c.id);
                                                                    setSearchQuery(c.name);
                                                                    setShowDropdown(false);
                                                                }}
                                                                style={{
                                                                    padding: '12px',
                                                                    cursor: 'pointer',
                                                                    borderBottom: '1px solid #eee',
                                                                    fontWeight: 600,
                                                                    fontSize: '0.95rem'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            >
                                                                {c.name}
                                                            </div>
                                                        ))
                                                ) : (
                                                    <div style={{ padding: '12px', color: '#999', fontStyle: 'italic', fontSize: '0.95rem' }}>
                                                        No clients found
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                </div>

                                {session.seriesId && (
                                    <div style={{ padding: '16px', background: '#fff', border: '2px solid #000', marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '12px', fontSize: '0.8rem', color: '#666' }}>ADD TO SCOPE</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                                                <input
                                                    type="radio"
                                                    name="addScope"
                                                    value="single"
                                                    checked={addScope === 'single'}
                                                    onChange={() => setAddScope('single')}
                                                    style={{ width: '20px', height: '20px', accentColor: '#000' }}
                                                />
                                                Just this session
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                                                <input
                                                    type="radio"
                                                    name="addScope"
                                                    value="future"
                                                    checked={addScope === 'future'}
                                                    onChange={() => setAddScope('future')}
                                                    style={{ width: '20px', height: '20px', accentColor: '#000' }}
                                                />
                                                This and future sessions
                                            </label>
                                        </div>

                                        {addScope === 'future' && (
                                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #ccc' }}>
                                                <label style={{ display: 'block', fontWeight: 800, marginBottom: '10px', fontSize: '0.8rem', color: '#666' }}>SELECT DAYS TO INCLUDE</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {getWeekdaysFromRecurringDetails(session.recurringDetails, session.day).map((day) => (
                                                        <label key={day.dayNum} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedWeekdays.includes(day.dayNum)}
                                                                onChange={() => toggleWeekday(day.dayNum)}
                                                                style={{ width: '18px', height: '18px', accentColor: '#000' }}
                                                            />
                                                            {day.name}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => setIsAddingClient(false)}
                                        className="button-secondary"
                                        style={{ flex: 1, padding: '12px' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmAddClient}
                                        disabled={!newClientId || isProcessing || (addScope === 'future' && session.seriesId && selectedWeekdays.length === 0)}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            background: !newClientId || isProcessing || (addScope === 'future' && session.seriesId && selectedWeekdays.length === 0) ? '#ccc' : '#000',
                                            color: '#fff',
                                            border: 'none',
                                            fontWeight: 800,
                                            cursor: !newClientId || isProcessing || (addScope === 'future' && session.seriesId && selectedWeekdays.length === 0) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', marginBottom: '8px' }}>Clients</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {Array.isArray(session.clients) ? (isClient && isLimitlessOpen
                                            ? session.clients.filter((c: any) => c.id === (profile?.clientId || user?.uid) || c.uid === user?.uid)
                                            : session.clients
                                        ).map((c: any) => (
                                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f9f9', padding: '10px 14px', border: '1px solid #eee' }}>
                                                <span style={{ fontSize: '1rem', fontWeight: 800 }}>{c.name}</span>
                                                {/* 
                                                    Conditional Deletion Toggle:
                                                    1. Hide for Clients (they use the main buttons)
                                                    2. Hide for Admins/Managers if only 1 client exists (they use main DELETE)
                                                    3. Show for Admins/Managers if 2+ clients exist (allows partial removal)
                                                */}
                                                {(profile?.role === 'admin' || profile?.role === 'manager') && 
                                                 (Array.isArray(session.client_ids) ? session.client_ids.length > 1 : (session.clients?.length > 1)) && (
                                                    <button 
                                                        onClick={() => {
                                                            setTargetClientId(c.id);
                                                            setIsDeleting(true);
                                                        }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4444', padding: '4px' }}
                                                        title="Remove client"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        )) : (
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.clientName || 'Unknown Client'}</div>
                                        )}
                                        {hasCapacity && (
                                            <button
                                                onClick={() => setIsAddingClient(true)}
                                                style={{
                                                    marginTop: '8px',
                                                    padding: '8px',
                                                    background: 'transparent',
                                                    border: '2px dashed #ccc',
                                                    color: '#666',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                + Add Client to Session
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Briefcase size={20} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Trainer</label>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.trainerName}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CalendarIcon size={20} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Service</label>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.serviceName}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Time & Day</label>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.time} (Day {session.day + 1})</div>
                                </div>
                            </div>

                            {session.recurringDetails && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <RefreshCw size={20} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Recurrence</label>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{session.recurringDetails}</div>
                                    </div>
                                </div>
                            )}

                            {session.createdBy && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '40px', height: '40px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CalendarIcon size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#555' }}>Created by: {session.createdBy}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {!isAddingClient && (
                            <div style={{ display: 'flex', gap: '16px' }}>
                                {session?.status === 'Blocked' ? (
                                    isStaff && (
                                        <button
                                            onClick={() => setIsDeleting(true)}
                                            style={{
                                                flex: 1,
                                                height: '54px',
                                                background: '#000',
                                                color: '#fff',
                                                border: 'none',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px'
                                            }}
                                        >
                                            <Trash2 size={18} />
                                            UNBLOCK SLOT
                                        </button>
                                    )
                                ) : (
                                    !isTrainer && (
                                        <>
                                            <button
                                                onClick={() => onReschedule(session)}
                                                className="button-secondary"
                                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '54px' }}
                                            >
                                                <Edit2 size={18} />
                                                RESCHEDULE
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    // Recurring sessions still need the Delete Options screen to
                                                    // choose single-vs-future scope; a single session has no such
                                                    // choice to make, so skip straight to the confirm dialog instead
                                                    // of making the user click through a redundant screen first.
                                                    if (session.seriesId) {
                                                        setIsDeleting(true);
                                                    } else {
                                                        const confirmed = await confirm({
                                                            title: 'Delete Session?',
                                                            message: 'Are you sure you want to delete this session? This action cannot be undone.',
                                                            confirmLabel: 'Yes, Delete',
                                                            type: 'danger'
                                                        });
                                                        if (confirmed) await confirmDelete(targetClientId);
                                                    }
                                                }}
                                                disabled={isProcessing}
                                                style={{
                                                    flex: 1,
                                                    height: '54px',
                                                    background: '#ff4444',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontWeight: 800,
                                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                    opacity: isProcessing ? 0.5 : 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '10px'
                                                }}
                                            >
                                                <Trash2 size={18} />
                                                DELETE
                                            </button>
                                        </>
                                    )
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
