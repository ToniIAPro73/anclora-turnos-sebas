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
      className="month-shift-badge"
      onClick={() => onEditShift(shift.id)}
      style={{ borderLeft: `3px solid ${accentColor}`, color: accentColor }}
      onMouseOver={(event) => { event.currentTarget.style.background = 'var(--shift-badge-hover-bg)'; }}
      onMouseOut={(event) => { event.currentTarget.style.background = 'var(--shift-badge-bg)'; }}
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
    <div className="month-origin-section">
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
    <div className="month-grid-shell">
      <div className="month-grid-root">
        <div className="month-weekdays-row">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className="month-weekday-cell"
              style={{ color: index >= 5 ? 'var(--color-gold)' : 'var(--text-subtle)' }}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="month-grid-cells" style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}>
          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`blank-${index}`} className="month-grid-blank" />;
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
                className="month-day-cell"
                style={{
                  background: isToday ? 'var(--day-today-bg)' : 'var(--glass-bg)',
                  border: isToday ? '1px solid var(--color-gold)' : '1px solid var(--border-soft)',
                  boxShadow: 'inset 0 1px 0 var(--inner-highlight)',
                }}
              >
                <div
                  className="month-day-number"
                  style={{ color: isToday ? 'var(--color-gold)' : isWeekend ? 'var(--text-muted)' : 'var(--text-primary)' }}
                >
                  {day}
                </div>

                <div className="month-day-sections">
                  {renderOriginSection(ownShifts, onEditShift)}
                  {renderOriginSection(companyShifts, onEditShift)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
