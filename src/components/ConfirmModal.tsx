import React from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    type = 'info',
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger': return <AlertTriangle size={32} color="#ff4444" />;
            case 'warning': return <AlertTriangle size={32} color="#ffbb33" />;
            default: return <Info size={32} color="#000" />;
        }
    };

    const getConfirmButtonStyle = () => {
        const base = {
            padding: '12px 24px',
            fontSize: '1rem',
            fontWeight: 800,
            cursor: 'pointer',
            border: '3px solid #000',
            transition: 'all 0.2s ease'
        };

        if (type === 'danger') {
            return { ...base, background: '#ff4444', color: '#fff' };
        }
        return { ...base, background: '#000', color: '#fff' };
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
                maxWidth: '450px',
                padding: '40px',
                position: 'relative',
                background: '#fff',
                border: '4px solid #000',
                boxShadow: '12px 12px 0px rgba(0,0,0,0.2)'
            }}>
                <button
                    onClick={onCancel}
                    style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                    <X size={24} />
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
                    <div style={{ 
                        width: '64px', 
                        height: '64px', 
                        background: type === 'danger' ? '#fff5f5' : '#f5f5f5',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '3px solid #000'
                    }}>
                        {getIcon()}
                    </div>
                    
                    <div>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>{title}</h2>
                        <p className="text-muted" style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>{message}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', width: '100%', marginTop: '12px' }}>
                        <button
                            onClick={onCancel}
                            className="button-secondary"
                            style={{ flex: 1, padding: '12px 24px', fontSize: '1rem', fontWeight: 800, border: '3px solid #000' }}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            style={getConfirmButtonStyle() as any}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
