import { Shift } from '../../lib/types';
import { enrichShift } from '../../lib/shifts';
import { MapPin, ArrowRight } from 'lucide-react';

interface ShiftCardProps {
  shift: Shift;
  onClick: (id: string) => void;
}

export const ShiftCard = ({ shift, onClick }: ShiftCardProps) => {
  const enriched = enrichShift(shift);
  
  const getCategoryClass = (cat: string) => {
    switch (cat) {
      case 'Mañana': return 'morning';
      case 'Tarde': return 'afternoon';
      case 'Noche': return 'night';
      default: return '';
    }
  };

  const categoryClass = getCategoryClass(enriched.category);

  return (
    <div 
      className={`shift-card ${categoryClass}`}
      onClick={() => onClick(shift.id)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
        <span style={{ 
          fontSize: '0.7rem', 
          fontWeight: '800', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em',
          color: enriched.category === 'Noche' ? '#AFD2FA' : 'var(--color-surface)',
          opacity: enriched.category === 'Noche' ? 1 : 0.8
        }}>
          {enriched.category}
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>
          {enriched.duration.toFixed(1)}h
        </span>
      </div>
      
      <div style={{ 
        fontWeight: '700', 
        fontSize: '1.1rem', 
        marginBottom: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        {shift.startTime} <ArrowRight size={14} style={{ opacity: 0.5 }} /> {shift.endTime}
      </div>

      {shift.location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'rgba(245, 245, 240, 0.4)' }}>
          <MapPin size={12} /> {shift.location}
        </div>
      )}
    </div>
  );
};
