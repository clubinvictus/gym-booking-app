import { useState, useEffect } from 'react';
import { X, Tag, Clock } from 'lucide-react';
import { db } from '../firebase';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    writeBatch,
    query,
    where
} from 'firebase/firestore';
import { SITE_ID } from '../constants';

interface AddServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (service: any) => void;
    editingService?: any;
}

const PREDEFINED_COLORS = [
    '#000000', // Black
    '#FF3B30', // Red
    '#FF9500', // Orange
    '#FFCC00', // Yellow
    '#34C759', // Green
    '#5AC8FA', // Light Blue
    '#007AFF', // Blue
    '#5856D6', // Purple
    '#FF2D55', // Pink
    '#8E8E93'  // Gray
];

export const AddServiceModal = ({ isOpen, onClose, onAdd, editingService }: AddServiceModalProps) => {
    const [name, setName] = useState('');
    const [duration, setDuration] = useState('60');
    const [color, setColor] = useState('#000000');
    const [assignedTrainerIds, setAssignedTrainerIds] = useState<string[]>([]);
    const [trainers, setTrainers] = useState<any[]>([]);
    const [maxCapacity, setMaxCapacity] = useState(1);
    const [allowedTiers, setAllowedTiers] = useState<string[]>(['limitless', 'limitless_open']);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchTrainers = async () => {
            const querySnapshot = await getDocs(collection(db, 'trainers'));
            setTrainers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        if (isOpen) fetchTrainers();
    }, [isOpen]);

    useEffect(() => {
        if (editingService) {
            setName(editingService.name || '');
            setDuration(editingService.duration?.toString() || '60');
            setColor(editingService.color || '#000000');
            setMaxCapacity(editingService.max_capacity || 1);
            setAllowedTiers(editingService.allowed_tiers || ['limitless', 'limitless_open']);
            // Assuming we store assigned trainers on the service or check trainers' qualified services
            // Let's assume for now we'll handle assignment on the service document
            setAssignedTrainerIds(editingService.assigned_trainer_ids || []);
        } else {
            setName('');
            setDuration('60');
            setColor('#000000');
            setMaxCapacity(1);
            setAllowedTiers(['limitless', 'limitless_open']);
            setAssignedTrainerIds([]);
        }
    }, [editingService, isOpen]);
    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            if (allowedTiers.length === 0) {
                alert('Please select at least one allowed membership tier.');
                setIsSaving(false);
                return;
            }

            const serviceData = {
                name,
                duration: parseInt(duration),
                color,
                max_capacity: maxCapacity,
                allowed_tiers: allowedTiers,
                assigned_trainer_ids: assignedTrainerIds,
                siteId: SITE_ID
            };

            if (editingService) {
                const serviceRef = doc(db, 'services', editingService.id);
                await updateDoc(serviceRef, serviceData);

                // GLOBAL SYNC: If name changed, update all trainers
                if (editingService.name !== name) {
                    const trainersRef = collection(db, 'trainers');
                    const q = query(trainersRef, where('specialties', 'array-contains', editingService.name));
                    const trainerDocs = await getDocs(q);

                    if (!trainerDocs.empty) {
                        const batch = writeBatch(db);
                        trainerDocs.forEach(tDoc => {
                            const currentSpecialties = tDoc.data().specialties || [];
                            const updatedSpecialties = currentSpecialties.map((s: string) =>
                                s === editingService.name ? name : s
                            );
                            batch.update(tDoc.ref, { specialties: updatedSpecialties });
                        });
                        await batch.commit();
                    }
                }
            } else {
                await addDoc(collection(db, 'services'), serviceData);
            }

            onAdd(serviceData);
            onClose();
        } catch (error) {
            console.error('Error saving service:', error);
            alert('Failed to save service.');
        } finally {
            setIsSaving(false);
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
            backdropFilter: 'blur(4px)',
            padding: '20px'
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '500px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000',
                padding: 0 // Remove padding here to allow header/footer to be full width
            }}>
                {/* Header - Fixed */}
                <div style={{ padding: '32px 32px 16px 32px', borderBottom: '2px solid #eee' }}>
                    <button
                        onClick={onClose}
                        style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                        <X size={24} />
                    </button>

                    <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{editingService ? 'Edit Service' : 'Create Service'}</h2>
                    <p className="text-muted" style={{ marginBottom: 0, fontSize: '0.9rem' }}>
                        {editingService ? 'Update your service details.' : "Add a new offering to your studio's catalog."}
                    </p>
                </div>

                {/* Body - Scrollable */}
                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '24px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>SERVICE NAME</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '14px' }}><Tag size={18} className="text-muted" /></div>
                            <input
                                type="text"
                                placeholder="e.g. Personal Training"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 48px',
                                    borderRadius: 0,
                                    border: '2px solid #000',
                                    fontSize: '1rem',
                                    fontWeight: 600
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>DURATION (MIN)</label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '16px', top: '14px' }}><Clock size={18} className="text-muted" /></div>
                                <input
                                    type="number"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 48px',
                                        borderRadius: 0,
                                        border: '2px solid #000',
                                        fontSize: '1rem',
                                        fontWeight: 600
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>MAX CAPACITY</label>
                            <input
                                type="number"
                                min="1"
                                value={maxCapacity}
                                onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 1)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: 0,
                                    border: '2px solid #000',
                                    fontSize: '1rem',
                                    fontWeight: 600
                                }}
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '12px', fontSize: '0.9rem' }}>BRAND COLOR</label>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {PREDEFINED_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        backgroundColor: c,
                                        border: color === c ? '3px solid #000' : '2px solid transparent',
                                        boxShadow: color === c ? '0 0 0 2px #fff inset' : 'none',
                                        cursor: 'pointer',
                                        transition: 'transform 0.1s ease',
                                        transform: color === c ? 'scale(1.1)' : 'scale(1)'
                                    }}
                                    title={c}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>ASSIGNED TRAINERS</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '2px solid #000', padding: '12px', maxHeight: '160px', overflowY: 'auto' }}>
                            {trainers.map(t => (
                                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={assignedTrainerIds.includes(t.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setAssignedTrainerIds(prev => [...prev, t.id]);
                                            else setAssignedTrainerIds(prev => prev.filter(id => id !== t.id));
                                        }}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.name}</span>
                                </label>
                            ))}
                            {trainers.length === 0 && <span className="text-muted" style={{ fontSize: '0.85rem' }}>No trainers available.</span>}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>MEMBERSHIP ACCESS</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: '2px solid #000', padding: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={allowedTiers.includes('limitless')}
                                    onChange={(e) => {
                                        if (e.target.checked) setAllowedTiers(prev => [...prev, 'limitless']);
                                        else setAllowedTiers(prev => prev.filter(t => t !== 'limitless'));
                                    }}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 700 }}>Limitless</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={allowedTiers.includes('limitless_open')}
                                    onChange={(e) => {
                                        if (e.target.checked) setAllowedTiers(prev => [...prev, 'limitless_open']);
                                        else setAllowedTiers(prev => prev.filter(t => t !== 'limitless_open'));
                                    }}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 700 }}>Limitless Open</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#f5f5f5', padding: '4px', margin: '-4px' }}>
                                <input
                                    type="checkbox"
                                    checked={allowedTiers.includes('lead')}
                                    onChange={(e) => {
                                        if (e.target.checked) setAllowedTiers(prev => [...prev, 'lead']);
                                        else setAllowedTiers(prev => prev.filter(t => t !== 'lead'));
                                    }}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 700 }}>Lead (Trial Prospect)</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer - Fixed */}
                <div style={{ padding: '24px 32px', borderTop: '2px solid #eee', background: '#fafafa' }}>
                    <button
                        className="button-primary"
                        style={{ width: '100%', padding: '18px', fontWeight: 900, fontSize: '1rem', letterSpacing: '1px' }}
                        onClick={handleSubmit}
                        disabled={isSaving}
                    >
                        {isSaving ? 'SAVING...' : (editingService ? 'UPDATE SERVICE' : 'CREATE SERVICE')}
                    </button>
                </div>
            </div>
        </div>
    );
};
