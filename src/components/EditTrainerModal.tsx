import { useState, useEffect } from 'react';
import { X, User, Plus, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';

interface EditTrainerModalProps {
    isOpen: boolean;
    onClose: () => void;
    trainer: any;
}

export const EditTrainerModal = ({ isOpen, onClose, trainer }: EditTrainerModalProps) => {
    const [name, setName] = useState('');
    const [status, setStatus] = useState('Active');
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [availability, setAvailability] = useState<any>({});
    const [services, setServices] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchServices = async () => {
            const querySnapshot = await getDocs(collection(db, 'services'));
            setServices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchServices();
    }, []);

    useEffect(() => {
        if (trainer) {
            setName(trainer.name || '');
            setStatus(trainer.status || 'Active');
            setSpecialties(trainer.specialties || []);

            // Normalize old data to new shifts format
            const normalizedAvailability: any = {};
            const rawAvailability = trainer.availability || {};
            days.forEach(day => {
                const dayData = rawAvailability[day] || { active: true, start: '09:00', end: '17:00' };
                if (dayData.shifts) {
                    normalizedAvailability[day] = dayData;
                } else {
                    // Migrate single shift to shifts array
                    normalizedAvailability[day] = {
                        active: dayData.active ?? true,
                        shifts: [{ start: dayData.start || '09:00', end: dayData.end || '17:00' }]
                    };
                }
            });
            setAvailability(normalizedAvailability);
        }
    }, [trainer]);

    if (!isOpen || !trainer) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const trainerRef = doc(db, 'trainers', trainer.id);
            await updateDoc(trainerRef, {
                name,
                status,
                specialties,
                availability
            });
            onClose();
        } catch (error) {
            console.error('Error updating trainer:', error);
            alert('Failed to update trainer.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleDay = (day: string) => {
        setAvailability({
            ...availability,
            [day]: { ...availability[day], active: !availability[day].active }
        });
    };

    const updateShift = (day: string, index: number, type: 'start' | 'end', value: string) => {
        const newShifts = [...availability[day].shifts];
        newShifts[index] = { ...newShifts[index], [type]: value };
        setAvailability({
            ...availability,
            [day]: { ...availability[day], shifts: newShifts }
        });
    };

    const addShift = (day: string) => {
        setAvailability({
            ...availability,
            [day]: {
                ...availability[day],
                shifts: [...availability[day].shifts, { start: '09:00', end: '17:00' }]
            }
        });
    };

    const removeShift = (day: string, index: number) => {
        if (availability[day].shifts.length <= 1) return;
        const newShifts = availability[day].shifts.filter((_: any, i: number) => i !== index);
        setAvailability({
            ...availability,
            [day]: { ...availability[day], shifts: newShifts }
        });
    };

    const applyToAll = (sourceDay: string) => {
        const sourceSchedule = availability[sourceDay];
        if (!sourceSchedule) return;

        const newAvailability = { ...availability };
        days.forEach(day => {
            newAvailability[day] = {
                ...newAvailability[day],
                shifts: JSON.parse(JSON.stringify(sourceSchedule.shifts)), // Deep clone shifts
                active: true
            };
        });
        setAvailability(newAvailability);
    };

    const toggleSpecialty = (s: string) => {
        if (specialties.includes(s)) {
            setSpecialties(specialties.filter(item => item !== s));
        } else {
            setSpecialties([...specialties, s]);
        }
    };

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

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
                maxWidth: '650px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '32px',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                    <X size={24} />
                </button>

                <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Edit Trainer</h2>
                <p className="text-muted" style={{ marginBottom: '24px' }}>Update profile and schedule for {trainer.name}.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>FULL NAME</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '14px' }}><User size={18} className="text-muted" /></div>
                            <input
                                type="text"
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

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>STATUS</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: 0,
                                border: '2px solid #000',
                                fontSize: '1rem',
                                fontWeight: 600,
                                background: '#fff'
                            }}
                        >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>QUALIFIED SERVICES</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {services.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => toggleSpecialty(s.name)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: 0,
                                        border: '2px solid #000',
                                        background: specialties.includes(s.name) ? '#000' : '#fff',
                                        color: specialties.includes(s.name) ? '#fff' : '#000',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <label style={{ fontWeight: 800, fontSize: '0.9rem' }}>AVAILABILITY SCHEDULE</label>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#666' }}>SELECT MULTIPLE BLOCKS PER DAY</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {days.map(day => (
                                <div key={day} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '16px',
                                    background: availability[day]?.active ? '#fff' : '#f5f5f5',
                                    border: availability[day]?.active ? '2px solid #000' : '2px solid #ddd'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: availability[day]?.active ? '12px' : 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="checkbox"
                                                checked={availability[day]?.active}
                                                onChange={() => toggleDay(day)}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.9rem' }}>{day}</span>
                                        </div>
                                        {availability[day]?.active && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => addShift(day)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}
                                                >
                                                    <Plus size={14} /> ADD SHIFT
                                                </button>
                                                <button
                                                    onClick={() => applyToAll(day)}
                                                    style={{ padding: '6px 12px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}
                                                >
                                                    APPLY TO ALL
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {availability[day]?.active && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {availability[day].shifts.map((shift: any, sIdx: number) => (
                                                <div key={sIdx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                    <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <input
                                                            type="time"
                                                            value={shift.start}
                                                            onChange={(e) => updateShift(day, sIdx, 'start', e.target.value)}
                                                            style={{ flex: 1, padding: '10px', border: '2px solid #000', borderRadius: 0, fontWeight: 700 }}
                                                        />
                                                        <span style={{ fontWeight: 800 }}>-</span>
                                                        <input
                                                            type="time"
                                                            value={shift.end}
                                                            onChange={(e) => updateShift(day, sIdx, 'end', e.target.value)}
                                                            style={{ flex: 1, padding: '10px', border: '2px solid #000', borderRadius: 0, fontWeight: 700 }}
                                                        />
                                                    </div>
                                                    {availability[day].shifts.length > 1 && (
                                                        <button
                                                            onClick={() => removeShift(day, sIdx)}
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff4444', padding: '4px' }}
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        className="button-primary"
                        style={{ width: '100%', padding: '16px', marginTop: '12px' }}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving Changes...' : 'Save Trainer Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
};
