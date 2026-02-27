import { useMemo } from 'react';
import { Shift } from '../../lib/types';
import { getNextShift, aggregateWeeklyStats } from '../../lib/shifts';
import { Clock, Calendar, CheckCircle } from 'lucide-react';

interface StatsBarProps {
  shifts: Shift[];
  currentWeekShifts: Shift[];
}

export const StatsBar = ({ shifts, currentWeekShifts }: StatsBarProps) => {
  const nextShift = useMemo(() => getNextShift(shifts), [shifts]);
  const stats = useMemo(() => aggregateWeeklyStats(currentWeekShifts), [currentWeekShifts]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
      <div className="stats-bar-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--color-gold)', fontSize: '0.875rem', fontWeight: '600', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Clock size={18} /> Próximo Turno
        </div>
        <div style={{ fontWeight: '700', fontSize: '1.5rem', color: 'var(--color-accent)' }}>
          {nextShift ? `${nextShift.startTime} · ${nextShift.date}` : 'Sin turnos'}
        </div>
      </div>
      
      <div className="stats-bar-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--color-gold)', fontSize: '0.875rem', fontWeight: '600', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Calendar size={18} /> Rendimiento Semanal
        </div>
        <div style={{ fontWeight: '700', fontSize: '1.5rem', color: 'var(--color-accent)' }}>
          {stats.weeklyHours.toFixed(1)} <span style={{ fontSize: '1rem', opacity: 0.7 }}>horas</span>
        </div>
      </div>

      <div className="stats-bar-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--color-gold)', fontSize: '0.875rem', fontWeight: '600', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <CheckCircle size={18} /> Días de Descanso
        </div>
        <div style={{ fontWeight: '700', fontSize: '1.5rem', color: 'var(--color-accent)' }}>
          {stats.freeDays} {stats.freeDays === 1 ? 'día' : 'días'}
        </div>
      </div>
    </div>
  );
};
