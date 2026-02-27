import React from 'react';
import { Shift } from '../../types/shift';
import { getWeekRange, formatDisplayDate } from '../../lib/date-utils';
import { ShiftCard } from './ShiftCard';

interface WeekGridProps {
  currentWeekStart: string;
  shifts: Shift[];
  onEditShift: (id: string) => void;
}

export const WeekGrid: React.FC<WeekGridProps> = ({ currentWeekStart, shifts, onEditShift }) => {
  const days = getWeekRange(currentWeekStart);

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(7, 1fr)', 
      gap: 'var(--space-sm)',
      overflowX: 'auto',
      minWidth: '800px',
      paddingBottom: 'var(--space-md)'
    }}>
      {days.map(day => {
        const dayShifts = shifts.filter(s => s.date === day);
        const isToday = day === new Date().toISOString().split('T')[0];

        return (
          <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <div style={{ 
              textAlign: 'center', 
              padding: 'var(--space-xs)', 
              borderRadius: 'var(--radius)', 
              background: isToday ? 'var(--primary)' : 'transparent',
              color: isToday ? 'white' : 'var(--text-muted)',
              fontSize: '0.875rem',
              fontWeight: isToday ? 'bold' : 'normal'
            }}>
              {formatDisplayDate(day).split(' ')[0]}
              <div style={{ fontSize: '1.125rem' }}>{day.split('-')[2]}</div>
            </div>
            
            <div style={{ 
              flex: 1, 
              minHeight: '200px', 
              background: 'rgba(0,0,0,0.02)', 
              borderRadius: 'var(--radius)', 
              padding: 'var(--space-xs)',
              border: '2px dashed #e2e8f0'
            }}>
              {dayShifts.map(shift => (
                <ShiftCard key={shift.id} shift={shift} onClick={onEditShift} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
