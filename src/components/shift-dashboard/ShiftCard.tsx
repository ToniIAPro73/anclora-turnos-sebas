import { Shift } from '../../types/shift';
import { enrichShift } from '../../lib/shift-logic';
import { MapPin } from 'lucide-react';

interface ShiftCardProps {
  shift: Shift;
  onClick: (id: string) => void;
}

export const ShiftCard = ({ shift, onClick }: ShiftCardProps) => {
  const enriched = enrichShift(shift);
  
  const getCategoryStyles = (cat: string) => {
    switch (cat) {
      case 'Mañana': return { bg: 'var(--color-morning)', text: 'var(--text-morning)' };
      case 'Tarde': return { bg: 'var(--color-afternoon)', text: 'var(--text-afternoon)' };
      case 'Noche': return { bg: 'var(--color-night)', text: 'var(--text-night)' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  const styles = getCategoryStyles(enriched.category);

  return (
    <div 
      className="card" 
      onClick={() => onClick(shift.id)}
      style={{ 
        padding: 'var(--space-sm)', 
        background: styles.bg, 
        border: `1px solid ${styles.text}20`,
        cursor: 'pointer',
        marginBottom: 'var(--space-xs)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xs)' }}>
        <span style={{ fontWeight: '700', color: styles.text, fontSize: '0.875rem' }}>{enriched.category}</span>
        <span style={{ fontSize: '0.75rem', color: styles.text, opacity: 0.8 }}>{enriched.duration.toFixed(1)}h</span>
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: 'var(--space-xs)' }}>
        {shift.startTime} - {shift.endTime}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <MapPin size={12} /> {shift.location || 'S/U'}
      </div>
    </div>
  );
};
