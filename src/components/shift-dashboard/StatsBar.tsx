import React, { useMemo } from 'react';
import { Shift } from '../../types/shift';
import { getNextShift, calculateWeeklyStats } from '../../lib/shift-logic';
import { Clock, Calendar, CheckCircle } from 'lucide-react';

interface StatsBarProps {
  shifts: Shift[];
  currentWeekShifts: Shift[];
}

export const StatsBar: React.FC<StatsBarProps> = ({ shifts, currentWeekShifts }) => {
  const nextShift = useMemo(() => getNextShift(shifts), [shifts]);
  const stats = useMemo(() => calculateWeeklyStats(currentWeekShifts), [currentWeekShifts]);

  return (
    <div className="stats-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
      <div className="card glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-xs)' }}>
          <Clock size={16} /> Próximo Turno
        </div>
        <div style={{ fontWeight: '700', fontSize: '1.25rem' }}>
          {nextShift ? `${nextShift.startTime} - ${nextShift.date}` : 'Sin turnos'}
        </div>
      </div>
      
      <div className="card glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-xs)' }}>
          <Calendar size={16} /> Horas Semanales
        </div>
        <div style={{ fontWeight: '700', fontSize: '1.25rem' }}>
          {stats.weeklyHours.toFixed(1)} h
        </div>
      </div>

      <div className="card glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-xs)' }}>
          <CheckCircle size={16} /> Días Libres
        </div>
        <div style={{ fontWeight: '700', fontSize: '1.25rem' }}>
          {stats.freeDays} {stats.freeDays === 1 ? 'día' : 'días'}
        </div>
      </div>
    </div>
  );
};
