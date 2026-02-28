import { Shift } from '../../lib/types';
import { getDaysInMonth, getFirstWeekdayOfMonth, toISODate } from '../../lib/week';
import { computeShiftCategory } from '../../lib/shifts';

interface MonthGridProps {
  year: number;
  month: number;
  shifts: Shift[];
  onEditShift: (id: string) => void;
}

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const categoryColor: Record<string, string> = {
  'Mañana': 'var(--color-accent)',
  'Tarde': 'var(--color-gold)',
  'Noche': '#8b5cf6',
};

export const MonthGrid = ({ year, month, shifts, onEditShift }: MonthGridProps) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekdayOfMonth(year, month);
  const todayISO = toISODate(new Date());

  // Build cells: leading blanks + actual days
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Trailing blanks to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  const getShiftsForDay = (day: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return shifts.filter(s => s.date === iso);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Weekday header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px',
        marginBottom: '4px', flexShrink: 0
      }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: '0.7rem', fontWeight: '800',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: i >= 5 ? 'var(--color-gold)' : 'rgba(245,245,240,0.35)',
            padding: '4px 0'
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: `repeat(${cells.length / 7}, 1fr)`,
        gap: '3px', flex: 1, overflow: 'hidden'
      }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`blank-${i}`} style={{ borderRadius: '10px' }} />;
          }

          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayShifts = getShiftsForDay(day);
          const isToday = iso === todayISO;
          const isWeekend = i % 7 >= 5;

          return (
            <div
              key={day}
              style={{
                background: isToday ? 'rgba(212, 175, 55, 0.1)' : 'var(--glass-bg)',
                border: isToday ? '1px solid var(--color-gold)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '4px 6px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              <div style={{
                fontSize: '0.75rem', fontWeight: '800',
                color: isToday ? 'var(--color-gold)' : isWeekend ? 'rgba(245,245,240,0.5)' : 'var(--color-surface)',
                marginBottom: '2px', flexShrink: 0
              }}>
                {day}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                {dayShifts.map(shift => {
                  const cat = computeShiftCategory(shift.startTime);
                  return (
                    <div
                      key={shift.id}
                      onClick={() => onEditShift(shift.id)}
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: '600',
                        borderLeft: `3px solid ${categoryColor[cat] || 'white'}`,
                        padding: '2px 4px',
                        borderRadius: '4px',
                        background: 'rgba(0,0,0,0.2)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                        transition: 'background 0.15s',
                        color: categoryColor[cat] || 'white',
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.2)')}
                    >
                      {shift.startTime}–{shift.endTime}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
