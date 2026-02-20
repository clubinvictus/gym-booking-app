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

export const AddServiceModal = ({ isOpen, onClose, onAdd, editingService }: AddServiceModalProps) => {
    const [name, setName] = useState('');
    const [duration, setDuration] = useState('60');
    const [assignedTrainerIds, setAssignedTrainerIds] = useState<string[]>([]);
    const [trainers, setTrainers] = useState<any[]>([]);
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
            // Assuming we store assigned trainers on the service or check trainers' qualified services
            // Let's assume for now we'll handle assignment on the service document
            setAssignedTrainerIds(editingService.assignedTrainerIds || []);
        } else {
            setName('');
            setDuration('60');
            setAssignedTrainerIds([]);
        }
    }, [editingService, isOpen]);
    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            const serviceData = {
                name,
                duration: parseInt(duration),
                assignedTrainerIds,
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

    const toggleTrainer = (id: string) => {
        setAssignedTrainerIds(prev =>
            prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
        );
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
                maxWidth: '500px',
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

                <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{editingService ? 'Edit Service' : 'Create Service'}</h2>
                <p className="text-muted" style={{ marginBottom: '24px' }}>{editingService ? 'Update your service details.' : "Add a new offering to your studio's catalog."}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
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
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', fontSize: '0.9rem' }}>ASSIGN TRAINERS</label>
                        <div style={{
                            border: '2px solid #000',
                            borderRadius: '8px',
                            padding: '12px',
                            maxHeight: '150px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            {trainers.map(t => (
                                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={assignedTrainerIds.includes(t.id)}
                                        onChange={() => toggleTrainer(t.id)}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    {t.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        className="button-primary"
                        style={{ marginTop: '12px', width: '100%', padding: '16px' }}
                        onClick={handleSubmit}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : (editingService ? 'Save Changes' : 'Create Service')}
                    </button>
                </div>
            </div>
        </div>
    );
};
