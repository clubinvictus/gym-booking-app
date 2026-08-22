export const CalendarRetiredPage = () => {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
            padding: '20px'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '40px', textAlign: 'center' }}>
                <img src="/logo black.png" alt="Invictus" style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '16px' }} />
                <h1 style={{ fontSize: '1.6rem', marginBottom: '16px' }}>This calendar is no longer in use</h1>
                <p className="text-muted" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
                    Contact the front desk for help booking slots.
                </p>
            </div>
        </div>
    );
};
