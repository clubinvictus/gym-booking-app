import { X, AlertTriangle, Calendar, User } from 'lucide-react';

interface ConfirmOffDayModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    trainerName: string;
    date: Date;
}

export const ConfirmOffDayModal = ({ isOpen, onClose, onConfirm, trainerName, date }: ConfirmOffDayModalProps) => {
    if (!isOpen) return null;

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
                maxWidth: '450px',
                padding: '40px',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000',
                boxShadow: '20px 20px 0 rgba(0,0,0,0.2)'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                    <X size={24} />
                </button>

                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: '#fff1f1',
                        border: '3px solid #ff4444',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ff4444',
                        margin: '0 auto 20px'
                    }}>
                        <AlertTriangle size={40} />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '12px' }}>Confirm Off-Day</h2>
                    <p className="text-muted" style={{ fontSize: '1rem', fontWeight: 600 }}>
                        Are you sure you want to call an off-day for this trainer?
                    </p>
                </div>

                <div style={{
                    background: '#f9f9f9',
                    padding: '24px',
                    border: '2px solid #eee',
                    marginBottom: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <User size={20} className="text-muted" />
                        <div>
                            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', marginBottom: '2px' }}>TRAINER</p>
                            <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{trainerName}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calendar size={20} className="text-muted" />
                        <div>
                            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', marginBottom: '2px' }}>DATE</p>
                            <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={onConfirm}
                        className="button-primary"
                        style={{
                            width: '100%',
                            height: '54px',
                            fontSize: '1rem',
                            background: '#ff4444',
                            borderColor: '#ff4444'
                        }}
                    >
                        YES, CONFIRM OFF-DAY
                    </button>
                    <button
                        onClick={onClose}
                        className="button-secondary"
                        style={{ width: '100%', height: '54px', fontSize: '1rem' }}
                    >
                        CANCEL
                    </button>
                </div>
            </div>
        </div>
    );
};
