import { useMemo } from 'react';
import { Shift } from '../../lib/types';
import { getNextShift, aggregateWeeklyStats } from '../../lib/shifts';
import { Clock, Calendar, CheckCircle } from 'lucide-react';

interface StatsBarProps {
  shifts: Shift[];
  currentMonthShifts: Shift[];
  daysInMonth: number;
}

export const StatsBar = ({ shifts, currentMonthShifts, daysInMonth }: StatsBarProps) => {
  const nextShift = useMemo(() => getNextShift(shifts), [shifts]);
  const stats = useMemo(() => aggregateWeeklyStats(currentMonthShifts, daysInMonth), [currentMonthShifts, daysInMonth]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', flexShrink: 0 }}>
      <div className="stats-bar-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-gold)', fontSize: '0.7rem', fontWeight: '700', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Clock size={13} /> Próximo
        </div>
        <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nextShift ? `${nextShift.startTime} · ${nextShift.date.slice(5)}` : 'Sin turnos'}
        </div>
      </div>

      <div className="stats-bar-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-gold)', fontSize: '0.7rem', fontWeight: '700', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Calendar size={13} /> Horas Mes
        </div>
        <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-accent)' }}>
          {stats.weeklyHours.toFixed(1)} <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>h</span>
        </div>
      </div>

      <div className="stats-bar-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-gold)', fontSize: '0.7rem', fontWeight: '700', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <CheckCircle size={13} /> Libres
        </div>
        <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-accent)' }}>
          {stats.freeDays} <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>días</span>
        </div>
      </div>
    </div>
  );
};
