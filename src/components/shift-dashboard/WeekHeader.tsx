import { ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import { addWeeks } from '../../lib/week';

interface WeekHeaderProps {
  currentWeekStart: string;
  onNavigate: (newStart: string) => void;
  onAddShift: () => void;
}

export const WeekHeader = ({ currentWeekStart, onNavigate, onAddShift }: WeekHeaderProps) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)', borderBottom: '1px solid rgba(175, 210, 250, 0.1)', paddingBottom: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>
            Shift Dashboard
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'rgba(245, 245, 240, 0.5)', marginTop: '2px' }}>Anclora Cognitive Solutions</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', background: 'rgba(255,255,255,0.05)', borderRadius: '14px', padding: '6px' }}>
          <button 
            className="btn-ghost" 
            style={{ padding: '8px', color: 'var(--color-accent)' }}
            onClick={() => onNavigate(addWeeks(currentWeekStart, -1))}
          >
            <ChevronLeft size={24} />
          </button>
          <div style={{ padding: '0 var(--space-md)', fontWeight: '700', fontSize: '1rem', minWidth: '220px', textAlign: 'center' }}>
            Semana del {new Date(currentWeekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <button 
            className="btn-ghost" 
            style={{ padding: '8px', color: 'var(--color-accent)' }}
            onClick={() => onNavigate(addWeeks(currentWeekStart, 1))}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <button className="btn-gold" onClick={onAddShift} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <PlusCircle size={20} /> Añadir Turno
      </button>
    </div>
  );
};
