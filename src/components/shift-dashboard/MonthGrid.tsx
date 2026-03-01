import { Shift } from '../../lib/types';
import { getDaysInMonth, getFirstWeekdayOfMonth, toISODate } from '../../lib/week';
import { getShiftOrigin, getShiftType, hasShiftTimes } from '../../lib/shifts';

interface MonthGridProps {
  year: number;
  month: number;
  shifts: Shift[];
  onEditShift: (id: string) => void;
}

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const typeColor: Record<string, string> = {
  Regular: '#3b82f6',
  JT: '#a78bfa',
  Extras: '#D4AF37',
  Libre: '#ef4444',
};

function renderShiftBadge(shift: Shift, onEditShift: (id: string) => void) {
  const shiftType = getShiftType(shift);
  const shiftOrigin = getShiftOrigin(shift);
  const accentColor = typeColor[shiftType] || '#3b82f6';
  const hasTimes = hasShiftTimes(shift);
  const originPrefix = shiftOrigin === 'PDF' ? '(E)' : '(P)';

  return (
    <div
      key={shift.id}
      onClick={() => onEditShift(shift.id)}
      style={{
        fontSize: '0.58rem',
        fontWeight: '600',
        borderLeft: `3px solid ${accentColor}`,
        padding: '2px 4px',
        borderRadius: '4px',
        background: 'rgba(0,0,0,0.2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: 1.3,
        transition: 'background 0.15s',
        color: accentColor,
      }}
      onMouseOver={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseOut={(event) => { event.currentTarget.style.background = 'rgba(0,0,0,0.2)'; }}
    >
      {originPrefix} {shiftType}{hasTimes ? ` ${shift.startTime}–${shift.endTime}` : ''}
    </div>
  );
}

function renderOriginSection(
  shifts: Shift[],
  onEditShift: (id: string) => void,
) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '3px', padding: '2px 0', overflow: 'hidden' }}>
        {shifts.map((shift) => renderShiftBadge(shift, onEditShift))}
    </div>
  );
}

export const MonthGrid = ({ year, month, shifts, onEditShift }: MonthGridProps) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekdayOfMonth(year, month);
  const todayISO = toISODate(new Date());

  const cells: Array<number | null> = [];
  for (let index = 0; index < firstWeekday; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const getShiftsForDay = (day: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return shifts.filter((shift) => shift.date === iso);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px', flexShrink: 0 }}>
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            style={{
              textAlign: 'center',
              fontSize: '0.7rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: index >= 5 ? 'var(--color-gold)' : 'rgba(245,245,240,0.35)',
              padding: '4px 0',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))`, gap: '6px', flex: 1, minHeight: 0 }}>
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`blank-${index}`} style={{ borderRadius: '10px' }} />;
          }

          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayShifts = getShiftsForDay(day);
          const ownShifts = dayShifts.filter((shift) => getShiftOrigin(shift) === 'IMG');
          const companyShifts = dayShifts.filter((shift) => getShiftOrigin(shift) === 'PDF');
          const isToday = iso === todayISO;
          const isWeekend = index % 7 >= 5;

          return (
            <div
              key={day}
              style={{
                background: isToday ? 'rgba(212, 175, 55, 0.1)' : 'var(--glass-bg)',
                border: isToday ? '1px solid var(--color-gold)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px',
                padding: '7px 9px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  color: isToday ? 'var(--color-gold)' : isWeekend ? 'rgba(245,245,240,0.5)' : 'var(--color-surface)',
                  marginBottom: '4px',
                  flexShrink: 0,
                }}
              >
                {day}
              </div>

              <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: '1fr 1fr', gap: '3px', overflow: 'hidden' }}>
                {renderOriginSection(ownShifts, onEditShift)}
                {renderOriginSection(companyShifts, onEditShift)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
