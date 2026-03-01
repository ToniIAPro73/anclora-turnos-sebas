import { ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import { addWeeks } from '../../lib/week';

interface WeekHeaderProps {
  currentWeekStart: string;
  onNavigate: (newStart: string) => void;
  onAddShift: () => void;
  onImport: () => void;
}

export const WeekHeader = ({ currentWeekStart, onNavigate, onAddShift, onImport }: WeekHeaderProps) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: '800', background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em', lineHeight: 1 }}>
            Tablero de Turnos
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'rgba(245, 245, 240, 0.4)', marginTop: '2px' }}>by Anclora Group</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px' }}>
          <button 
            className="btn-ghost" 
            style={{ padding: '6px', color: 'var(--color-accent)' }}
            onClick={() => onNavigate(addWeeks(currentWeekStart, -1))}
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ padding: '0 var(--space-md)', fontWeight: '700', fontSize: '0.875rem', minWidth: '180px', textAlign: 'center' }}>
            {new Date(currentWeekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <button 
            className="btn-ghost" 
            style={{ padding: '6px', color: 'var(--color-accent)' }}
            onClick={() => onNavigate(addWeeks(currentWeekStart, 1))}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
        <button 
          className="btn-ghost" 
          onClick={onImport} 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', borderRadius: '10px' }}
        >
          Importar
        </button>
        <button className="btn-gold" onClick={onAddShift} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
          <PlusCircle size={18} /> <span style={{ fontSize: '0.875rem' }}>Añadir Turno</span>
        </button>
      </div>
    </div>
  );
};
