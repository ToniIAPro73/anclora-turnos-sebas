import { Shift } from '../../lib/types';
import { enrichShift, getShiftType, hasShiftTimes, isFreeShift } from '../../lib/shifts';
import { MapPin, ArrowRight } from 'lucide-react';

const typeColor: Record<string, string> = {
  'Regular': '#3b82f6',
  'JT': '#a78bfa',
  'Extras': '#D4AF37',
  'Libre': '#ef4444',
};

interface ShiftCardProps {
  shift: Shift;
  onClick: (id: string) => void;
}

export const ShiftCard = ({ shift, onClick }: ShiftCardProps) => {
  const shiftType = getShiftType(shift);
  const shiftIsFree = isFreeShift(shift);
  const accentColor = typeColor[shiftType] || '#3b82f6';
  if (shiftIsFree) {
    return (
      <div
        className="shift-card"
        onClick={() => onClick(shift.id)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: accentColor,
            opacity: 1
          }}>
            {shiftType}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>
            0.0h
          </span>
        </div>

        <div style={{
          fontWeight: '700',
          fontSize: '1.1rem',
          marginBottom: '6px',
          color: accentColor,
        }}>
          Dia libre
        </div>

        {shift.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'rgba(245, 245, 240, 0.4)' }}>
            <MapPin size={12} /> {shift.location}
          </div>
        )}
      </div>
    );
  }

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
          color: accentColor,
          opacity: 1
        }}>
          {shiftType}
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
        {hasShiftTimes(shift) ? (
          <>
            {shift.startTime} <ArrowRight size={14} style={{ opacity: 0.5 }} /> {shift.endTime}
          </>
        ) : (
          shiftType
        )}
      </div>

      {shift.location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'rgba(245, 245, 240, 0.4)' }}>
          <MapPin size={12} /> {shift.location}
        </div>
      )}
    </div>
  );
};
