import React from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';

interface TermsModalProps {
    isOpen: boolean;
    onAccepted: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onAccepted }) => {
    const { user } = useAuth();

    if (!isOpen) return null;

    const handleAccept = async () => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                termsAccepted: true,
                termsAcceptedAt: new Date().toISOString()
            });
            onAccepted();
        } catch (error) {
            console.error('Error updating terms acceptance:', error);
            alert('Failed to save agreement. Please try again.');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: '#fff',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                border: '4px solid #000',
                position: 'relative',
                animation: 'modalSlideUp 0.3s ease-out'
            }}>
                {/* Header with Logo */}
                <div style={{
                    backgroundColor: '#000',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <img src="/logo white.png" alt="Invictus" style={{ height: '48px', objectFit: 'contain' }} />
                    <h2 style={{ color: '#fff', margin: 0, fontSize: '1.5rem', letterSpacing: '0.1em' }}>LIMITLESS PROGRAM</h2>
                </div>

                <div style={{
                    padding: '32px',
                    overflowY: 'auto',
                    flex: 1,
                    fontSize: '0.95rem',
                    lineHeight: '1.6',
                    color: '#333'
                }}>
                    <section style={{ marginBottom: '24px' }}>
                        <h3 style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '16px', color: '#000' }}>Booking, Cancellations & No-Shows</h3>
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>Members may book up to one session per day, each lasting 50 minutes with a 10-minute buffer before the next session.</li>
                            <li>Members are not assigned to a single trainer and may train with any available trainer for sessions.</li>
                            <li>Calendar slots are booked on a first come, first serve basis.</li>
                            <li>Members may book sessions up to 14 days in advance.</li>
                            <li>Cancellations must be made at least 12 hours in advance.</li>
                            <li>Late cancellations or no-shows will result in the renewal date being moved forward by one day.</li>
                            <li>If a trainer becomes unavailable, the session will be reassigned to another trainer to avoid disruption.</li>
                            <li>If we are unable to fulfill a booked session, we will extend your membership by 1 day.</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '24px' }}>
                        <h3 style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '16px', color: '#000' }}>Health & Safety Waiver</h3>
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>Members acknowledge the inherent risks in exercise and confirm they are in suitable health to participate.</li>
                            <li>Members agree to disclose any medical conditions that may impact their training.</li>
                            <li>Invictus Athletic Club and trainers are not liable for injuries unless caused by gross negligence.</li>
                        </ul>
                    </section>

                    <section style={{ 
                        background: '#f9f9f9', 
                        padding: '20px', 
                        border: '2px dashed #ccc',
                        marginTop: '32px'
                    }}>
                        <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', color: '#000' }}>Agreement Confirmation</h3>
                        <p style={{ fontWeight: 600, color: '#000' }}>
                            I acknowledge that I have read, understood, and agreed to the terms above. I commit to participating in the Limitless Personal Training program with full effort and accountability to reach my goals.
                        </p>
                    </section>
                </div>

                <div style={{
                    padding: '24px',
                    borderTop: '2px solid #eee',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <button
                        onClick={handleAccept}
                        className="button-primary"
                        style={{
                            width: '100%',
                            padding: '16px',
                            fontSize: '1.1rem',
                            letterSpacing: '0.05em'
                        }}
                    >
                        I AGREE & CONFIRM
                    </button>
                    <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#666', margin: 0 }}>
                        By clicking "I AGREE & CONFIRM", you legally bind yourself to these terms.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
