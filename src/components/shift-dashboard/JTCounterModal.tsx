import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Shift } from '../../lib/types';
import { getShiftType, hasShiftTimes } from '../../lib/shifts';
import { durationMinutes } from '../../lib/time';

interface JTPeriodResult {
  totalDaysWithJT: number;
  totalHoursJT: number;
}

interface JTCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  shifts: Shift[];
}

function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const JTCounterModal = ({ isOpen, onClose, shifts }: JTCounterModalProps) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(getTodayISO());
  const [result, setResult] = useState<JTPeriodResult | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  const resetState = () => {
    setFromDate('');
    setToDate(getTodayISO());
    setResult(null);
    setHasCalculated(false);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    resetState();
  }, [isOpen]);

  const handleCalculate = () => {
    if (!toDate) {
      window.alert('Debes indicar una fecha "Hasta".');
      return;
    }

    if (fromDate && fromDate > toDate) {
      window.alert('La fecha "Desde" no puede ser posterior a la fecha "Hasta".');
      return;
    }

    const periodShifts = shifts.filter((shift) => {
      if (getShiftType(shift) !== 'JT') {
        return false;
      }

      if (shift.date > toDate) {
        return false;
      }

      if (fromDate && shift.date < fromDate) {
        return false;
      }

      return true;
    });

    const totalDaysWithJT = new Set(periodShifts.map((shift) => shift.date)).size;
    const totalHoursJT = periodShifts.reduce((hours, shift) => {
      if (!hasShiftTimes(shift)) {
        return hours;
      }

      return hours + (durationMinutes(shift.startTime, shift.endTime) / 60);
    }, 0);

    setResult({ totalDaysWithJT, totalHoursJT });
    setHasCalculated(true);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content jt-counter-modal-content" style={{ maxWidth: '980px', width: '96vw', minHeight: '480px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Contador turnos JT</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              className="btn-outline modal-reset-button"
              onClick={resetState}
              disabled={!hasCalculated}
              style={{ padding: '8px 12px', fontWeight: 700 }}
            >
              Nuevo Cálculo
            </button>
            <button onClick={onClose} style={{ color: 'var(--text-subtle)' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="jt-counter-modal-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.95fr) minmax(0, 1.05fr)', gap: '18px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Desde (opcional)</span>
                <input
                  className="modal-input"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Hasta</span>
                <input
                  className="modal-input"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </label>
            </div>

            <button
              className="btn-gold"
              onClick={handleCalculate}
              disabled={!toDate}
              style={{ padding: '14px 16px', width: '100%', minHeight: '52px', fontSize: '0.98rem', fontWeight: 800, opacity: toDate ? 1 : 0.5 }}
            >
              Calcular
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--panel-muted-bg)', borderRadius: '16px', padding: '16px', minWidth: 0 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-accent)', margin: '0 0 14px' }}>Resultado</h3>

            <div style={{ display: 'grid', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Nº total días con turnos JT en el periodo</span>
                <input
                  className="modal-input"
                  type="text"
                  value={result ? String(result.totalDaysWithJT) : ''}
                  readOnly
                  placeholder="Pendiente de cálculo"
                  style={{ fontWeight: 700, fontSize: '0.95rem' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Nº total horas de turnos JT en el periodo</span>
                <input
                  className="modal-input"
                  type="text"
                  value={result ? result.totalHoursJT.toFixed(1) : ''}
                  readOnly
                  placeholder="Pendiente de cálculo"
                  style={{ fontWeight: 700, fontSize: '0.95rem' }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
