import React from 'react';
import { ExtractedShift } from '../../lib/forge-shift-parser';

interface ShiftPreviewProps {
  shifts: ExtractedShift[];
  onEdit?: (index: number, field: string, value: string) => void;
  onRemove?: (index: number) => void;
}

const getMonthName = (month: number): string => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1] || '';
};

const getShiftTypeColor = (type: string): string => {
  const typeMap: Record<string, string> = {
    'Regular': '#3b82f6',
    'Libre': '#ef4444',
    'JT': '#a78bfa',
  };
  return typeMap[type] || '#6b7280';
};

export const ShiftPreview: React.FC<ShiftPreviewProps> = ({ shifts, onRemove }) => {
  if (shifts.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: 'rgba(245, 245, 240, 0.5)',
        fontSize: '0.875rem',
      }}>
        No hay turnos para mostrar
      </div>
    );
  }

  // Group shifts by month
  const groupedByMonth = shifts.reduce((acc, shift) => {
    const key = `${shift.month}/${shift.year}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(shift);
    return acc;
  }, {} as Record<string, ExtractedShift[]>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px' }}>
      {Object.entries(groupedByMonth).map(([monthKey, monthShifts]) => {
        const [month, year] = monthKey.split('/').map(Number);
        return (
          <div key={monthKey}>
            <h3 style={{
              fontSize: '0.875rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: 'rgba(245, 245, 240, 0.7)',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(245, 245, 240, 0.1)',
            }}>
              {getMonthName(month)} {year}
            </h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
            }}>
              {monthShifts.map((shift, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${getShiftTypeColor(shift.shiftType)}`,
                    backgroundColor: `${getShiftTypeColor(shift.shiftType)}15`,
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                    Día {shift.day}
                  </div>
                  <div style={{ color: getShiftTypeColor(shift.shiftType), fontWeight: '600' }}>
                    {shift.shiftType}
                  </div>
                  {shift.startTime && shift.endTime && (
                    <div style={{ marginTop: '4px', color: 'rgba(245, 245, 240, 0.7)' }}>
                      {shift.startTime} - {shift.endTime}
                    </div>
                  )}
                  {onRemove && (
                    <button
                      onClick={() => onRemove(idx)}
                      style={{
                        marginTop: '8px',
                        padding: '4px 8px',
                        fontSize: '0.65rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
