import { useMemo } from 'react';
import { Shift } from '../../lib/types';
import { aggregateWeeklyStats } from '../../lib/shifts';
import { Calendar, CheckCircle } from 'lucide-react';

interface StatsBarProps {
  currentMonthShifts: Shift[];
  daysInMonth: number;
}

export const StatsBar = ({ currentMonthShifts, daysInMonth }: StatsBarProps) => {
  const stats = useMemo(() => aggregateWeeklyStats(currentMonthShifts, daysInMonth), [currentMonthShifts, daysInMonth]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', flexShrink: 0 }}>
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
          <CheckCircle size={13} /> Desglose
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 12px' }}>
          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-accent)' }}>
            Regular {stats.hoursByType.Regular.toFixed(1)}<span style={{ fontSize: '0.75rem', opacity: 0.6 }}> h</span>
          </div>
          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#a78bfa' }}>
            JT {stats.hoursByType.JT.toFixed(1)}<span style={{ fontSize: '0.75rem', opacity: 0.6 }}> h</span>
          </div>
          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#ef4444' }}>
            Libres {stats.freeDays}<span style={{ fontSize: '0.75rem', opacity: 0.6 }}> días</span>
          </div>
          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-gold)' }}>
            Extras {stats.hoursByType.Extras.toFixed(1)}<span style={{ fontSize: '0.75rem', opacity: 0.6 }}> h</span>
          </div>
        </div>
      </div>
    </div>
  );
};
