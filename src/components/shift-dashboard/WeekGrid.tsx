import { Shift } from '../../lib/types';
import { getWeekDaysISO, fromISODate } from '../../lib/week';
import { ShiftCard } from './ShiftCard';

interface WeekGridProps {
  currentWeekStart: string;
  shifts: Shift[];
  onEditShift: (id: string) => void;
}

export const WeekGrid = ({ currentWeekStart, shifts, onEditShift }: WeekGridProps) => {
  const weekDays = getWeekDaysISO(currentWeekStart);

  const formatHeaderDate = (iso: string) => {
    const d = fromISODate(iso);
    const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(d);
    const daynum = new Intl.DateTimeFormat('es-ES', { day: 'numeric' }).format(d);
    return { weekday, daynum };
  };

  return (
    <div className="week-grid-container">
      {weekDays.map(day => {
        const dayShifts = shifts.filter(s => s.date === day);
        const { weekday, daynum } = formatHeaderDate(day);
        const isToday = day === new Date().toISOString().split('T')[0];

        return (
          <div key={day} className="day-column">
            <div style={{ 
              marginBottom: 'var(--space-md)',
              paddingBottom: 'var(--space-sm)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: '0.75rem', 
                fontWeight: '700', 
                textTransform: 'uppercase', 
                letterSpacing: '0.1em',
                color: isToday ? 'var(--color-gold)' : 'rgba(245, 245, 240, 0.4)'
              }}>
                {weekday}
              </div>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: '800',
                color: isToday ? 'var(--color-gold)' : 'var(--color-surface)',
                marginTop: '4px'
              }}>
                {daynum}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {dayShifts.map(shift => (
                <ShiftCard 
                  key={shift.id} 
                  shift={shift} 
                  onClick={onEditShift} 
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
