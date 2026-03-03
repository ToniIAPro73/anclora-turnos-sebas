import { useEffect, useState } from 'react';
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

export const MonthGrid = ({ year, month, shifts, onEditShift }: MonthGridProps) => {
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [isTouchUi, setIsTouchUi] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(pointer: coarse), (hover: none)');
    const update = () => setIsTouchUi(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    setExpandedShiftId(null);
  }, [month, year, shifts.length]);

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

  const handleShiftPress = (shift: Shift) => {
    if (!isTouchUi) {
      onEditShift(shift.id);
      return;
    }

    if (expandedShiftId === shift.id) {
      setExpandedShiftId(null);
      onEditShift(shift.id);
      return;
    }

    setExpandedShiftId(shift.id);
  };

  const renderShiftBadge = (shift: Shift) => {
    const shiftType = getShiftType(shift);
    const shiftOrigin = getShiftOrigin(shift);
    const accentColor = typeColor[shiftType] || '#3b82f6';
    const hasTimes = hasShiftTimes(shift);
    const originPrefix = shiftOrigin === 'PDF' ? '(E)' : '(P)';
    const isExpanded = expandedShiftId === shift.id;

    return (
      <button
        type="button"
        key={shift.id}
        className={isExpanded ? 'month-shift-badge is-expanded' : 'month-shift-badge'}
        onClick={() => handleShiftPress(shift)}
        onBlur={() => {
          if (expandedShiftId === shift.id) {
            setExpandedShiftId(null);
          }
        }}
        style={{ borderLeft: `3px solid ${accentColor}`, color: accentColor }}
        title={`${originPrefix} ${shiftType}${hasTimes ? ` ${shift.startTime}-${shift.endTime}` : ''}`}
      >
        {originPrefix} {shiftType}{hasTimes ? ` ${shift.startTime}–${shift.endTime}` : ''}
      </button>
    );
  };

  const renderShiftStack = (dayShifts: Shift[]) => (
    <div
      className="month-origin-section"
      data-shift-count={dayShifts.length}
    >
      {dayShifts.map((shift) => renderShiftBadge(shift))}
    </div>
  );

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
            const ownShifts = dayShifts.filter((shift) => getShiftOrigin(shift) === 'MAN');
            const companyShifts = dayShifts.filter((shift) => getShiftOrigin(shift) === 'PDF');
            const visibleShifts = [...ownShifts, ...companyShifts];
            const isToday = iso === todayISO;
            const isWeekend = index % 7 >= 5;

            return (
              <div
                key={day}
                className="month-day-cell"
                onClick={() => {
                  if (expandedShiftId) {
                    setExpandedShiftId(null);
                  }
                }}
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
                  {renderShiftStack(visibleShifts)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
