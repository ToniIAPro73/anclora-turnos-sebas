import { ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import { TurnosLogo } from '../branding/TurnosLogo';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface MonthHeaderProps {
  year: number;
  month: number;
  onNavigate: (delta: number) => void;
  onAddShift: () => void;
  onImport: () => void;
}

export const MonthHeader = ({ year, month, onNavigate, onAddShift, onImport }: MonthHeaderProps) => {
  return (
    <div className="dashboard-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', minWidth: 0 }}>
        <TurnosLogo />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: '800', background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em', lineHeight: 1 }}>
            Tablero de Turnos
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'rgba(245, 245, 240, 0.4)', marginTop: '2px' }}>by Anclora Group</p>
          <p style={{ fontSize: '0.72rem', color: 'rgba(245, 245, 240, 0.6)', marginTop: '4px' }}>
            Sebastian Pozo Mendoza · ID 84881
          </p>
        </div>
      </div>

      <div className="month-toolbar">
        <div className="month-navigator">
          <button
            style={{ padding: '6px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => onNavigate(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ padding: '0 var(--space-md)', fontWeight: '700', fontSize: '0.95rem', minWidth: '180px', textAlign: 'center' }}>
            {MONTH_NAMES[month]} {year}
          </div>
          <button
            style={{ padding: '6px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => onNavigate(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', flexShrink: 0 }}>
        <button
          onClick={onImport}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', borderRadius: '10px', background: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
        >
          Importar
        </button>
        <button className="btn-gold" onClick={onAddShift} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
          <PlusCircle size={18} /> <span style={{ fontSize: '0.875rem' }}>Añadir</span>
        </button>
      </div>
    </div>
  );
};
