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
    const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(d);
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
              paddingBottom: 'var(--space-xs)',
              borderBottom: '1px solid var(--border-soft)',
              textAlign: 'center',
              flexShrink: 0
            }}>
              <div style={{ 
                fontSize: '0.65rem', 
                fontWeight: '800', 
                textTransform: 'uppercase', 
                letterSpacing: '0.1em',
                color: isToday ? 'var(--color-gold)' : 'var(--text-subtle)'
              }}>
                {weekday}
              </div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: '800',
                color: isToday ? 'var(--color-gold)' : 'var(--text-primary)',
                marginTop: '2px'
              }}>
                {daynum}
              </div>
            </div>
            
            <div className="day-shifts-list">
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
