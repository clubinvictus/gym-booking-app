import React from 'react';
import type { GridProps } from './WeekGrid';

export const ResourceGrid: React.FC<GridProps> = ({ trainers }) => {
    return (
        <div style={{ flex: 1, padding: window.innerWidth <= 768 ? '0 16px' : '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                background: '#f9f9f9',
                border: '4px dashed #ccc',
                padding: '40px',
                textAlign: 'center',
                color: '#666'
            }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '8px', color: '#000' }}>Resource View Coming Soon</h3>
                <p>This view will map the {trainers.length} active trainers across the X-axis for scheduling.</p>
            </div>
        </div>
    );
};
