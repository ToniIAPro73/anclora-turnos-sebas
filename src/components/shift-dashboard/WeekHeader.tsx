import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatDisplayDate, parseISO, addDays, formatISO } from '../../lib/date-utils';

interface WeekHeaderProps {
  currentWeekStart: string;
  onNavigate: (newDate: string) => void;
  onAddShift: () => void;
}

export const WeekHeader: React.FC<WeekHeaderProps> = ({ currentWeekStart, onNavigate, onAddShift }) => {
  const sunday = formatISO(addDays(parseISO(currentWeekStart), 6));

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>Mis Turnos</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {formatDisplayDate(currentWeekStart)} - {formatDisplayDate(sunday)}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <button 
            onClick={() => onNavigate(formatISO(addDays(parseISO(currentWeekStart), -7)))}
            style={{ padding: 'var(--space-sm)', borderRight: '1px solid #e2e8f0' }}
            title="Semana anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => onNavigate(formatISO(addDays(new Date(), 0)).split('T')[0])} // Today (roughly)
            style={{ padding: '0 var(--space-md)', fontSize: '0.875rem', fontWeight: '600' }}
          >
            Hoy
          </button>
          <button 
             onClick={() => onNavigate(formatISO(addDays(parseISO(currentWeekStart), 7)))}
             style={{ padding: 'var(--space-sm)', borderLeft: '1px solid #e2e8f0' }}
             title="Semana siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <button 
          onClick={onAddShift}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}
        >
          <Plus size={18} /> Nuevo
        </button>
      </div>
    </div>
  );
};
