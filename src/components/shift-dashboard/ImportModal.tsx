import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileImage, Loader2, Trash2, Cpu } from 'lucide-react';
import { CalendarImportContext, ParsedCalendarShift, extractTextFromImageWithTesseract } from '../../lib/calendar-image-parser';
import { checkGeminiAvailable, parseCalendarTextWithGemini, parseCalendarWithGemini } from '../../lib/gemini-vision-parser';
import { Shift } from '../../lib/types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (shifts: Shift[], targetPeriod: CalendarImportContext) => void;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getYearMonth(date: string): string | null {
  return isIsoDate(date) ? date.slice(0, 7) : null;
}

function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function sanitizeMonthScope(shifts: ParsedCalendarShift[], preferredMonth?: string | null): ParsedCalendarShift[] {
  const targetMonth = preferredMonth;
  if (!targetMonth) {
    return shifts;
  }

  return shifts.filter((shift) => getYearMonth(shift.date) === targetMonth);
}

export const ImportModal = ({ isOpen, onClose, onConfirmImport }: ImportModalProps) => {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedShifts, setParsedShifts] = useState<ParsedCalendarShift[]>([]);
  const [visionModel, setVisionModel] = useState<string | null>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const availableYears = Array.from({ length: 7 }, (_, index) => String(now.getFullYear() - 2 + index));
  const monthOptions = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  // Check Gemini availability on mount
  useEffect(() => {
    checkGeminiAvailable().then(({ available, model }) => {
      setVisionModel(model);
      if (!available || !model) {
        setError('Falta configurar el proxy Forge/Gemini en el backend. Define BUILT_IN_FORGE_API_KEY o FORGE_API_KEY.');
      }
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setParsedShifts([]);
      setError(null);
      setScanTime(null);
    }
  };

  const handleStartOCR = async () => {
    if (!file || !selectedMonth || !selectedYear) return;
    setLoading(true);
    setError(null);
    setScanTime(null);
    const t0 = Date.now();
    const importContext: CalendarImportContext = {
      month: Number.parseInt(selectedMonth, 10),
      year: Number.parseInt(selectedYear, 10),
    };
    const selectedYearMonth = formatYearMonth(importContext.year, importContext.month);

    try {
      if (!visionModel) {
        throw new Error('Este flujo requiere el proxy backend con acceso a Gemini 2.5 Flash via Forge.');
      }

      const ocrText = await extractTextFromImageWithTesseract(file);
      let shifts: ParsedCalendarShift[];

      try {
        shifts = await parseCalendarWithGemini(file, importContext);
      } catch (visionError: any) {
        console.warn('[ImportModal] Vision import failed. Falling back to OCR text prompt.', visionError);
        shifts = await parseCalendarTextWithGemini(ocrText, importContext);
        setError(`Se uso OCR + LLM como fallback: ${visionError?.message || 'error desconocido'}`);
      }

      shifts = sanitizeMonthScope(shifts, selectedYearMonth);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      setScanTime(elapsed);
      console.log(`[ImportModal] ${shifts.length} shifts in ${elapsed}s`);

      if (shifts.length === 0) {
        setError('No se detectaron turnos. Revisa la consola para más detalles.');
      }

      setParsedShifts(shifts);
    } catch (err: any) {
      console.error('[ImportModal] Error:', err);
      setError(`Error: ${err?.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShift = (index: number, field: keyof ParsedCalendarShift, value: string) => {
    const updated = [...parsedShifts];
    updated[index] = { ...updated[index], [field]: value };
    setParsedShifts(updated);
  };

  const handleRemoveShift = (index: number) => {
    setParsedShifts(parsedShifts.filter((_, i) => i !== index));
  };

  const readyShifts = parsedShifts.filter(s => s.startTime !== '??:??' && s.endTime !== '??:??');

  const handleConfirm = () => {
    const importContext: CalendarImportContext = {
      month: Number.parseInt(selectedMonth, 10),
      year: Number.parseInt(selectedYear, 10),
    };
    const finalShifts: Shift[] = readyShifts.map(s => ({
      id: crypto.randomUUID(),
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.shiftType ? `Importado (${s.shiftType})` : 'Importado (OCR)'
    }));
    onConfirmImport(finalShifts, importContext);
    onClose();
  };

  if (!isOpen) return null;

  const modelLabel = visionModel ?? 'Gemini';

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '1000px', width: '95%', height: '85vh', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', color: 'rgba(245, 245, 240, 0.4)' }}>
          <X size={24} />
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '16px' }}>Importador Inteligente</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'rgba(245,245,240,0.72)' }}>
            <span>Mes del calendario</span>
            <select
              className="modal-input"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              style={{ padding: '10px 12px' }}
            >
              <option value="">Selecciona un mes</option>
              {monthOptions.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'rgba(245,245,240,0.72)' }}>
            <span>Año del calendario</span>
            <select
              className="modal-input"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              style={{ padding: '10px 12px' }}
            >
              {availableYears.map((yearOption) => (
                <option key={yearOption} value={yearOption}>
                  {yearOption}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <div
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid var(--color-gold)',
              background: 'rgba(212, 175, 55, 0.15)',
              color: visionModel ? 'var(--color-gold)' : 'rgba(245,245,240,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: '700',
              textTransform: 'uppercase',
            }}
          >
            <Cpu size={14} />
            {visionModel ? `${modelLabel} | Manus Forge` : 'Forge no configurado'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr', gap: '24px', flex: 1, overflow: 'hidden' }}>
          {/* Left: Upload & Image Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            {!previewUrl ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{ 
                  flex: 1, border: '2px dashed var(--glass-border)', borderRadius: '16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'background 0.2s', gap: '12px'
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '50%' }}>
                  <Upload size={32} color="var(--color-accent)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: '600' }}>Subir imagen del calendario</p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>Calendario mensual de turnos</p>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0a0f1e' }} />
                <button 
                  onClick={() => { setFile(null); setPreviewUrl(null); setParsedShifts([]); setError(null); setScanTime(null); }}
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,0,0,0.5)', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <Trash2 size={16} color="white" />
                </button>
              </div>
            )}
            
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
            
            <button 
              className="btn-gold" 
              disabled={!file || !selectedMonth || !selectedYear || !visionModel || loading} 
              onClick={handleStartOCR}
              style={{ padding: '12px', opacity: !file || !selectedMonth || !selectedYear || !visionModel || loading ? 0.5 : 1, width: '100%' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  {`Analizando con ${modelLabel}...`}
                </span>
              ) : 'Escanear Imagen'}
            </button>
          </div>

          {/* Right: Detected Data Table */}
          <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-accent)' }}>Turnos Detectados</h3>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                {parsedShifts.length} encontrados{scanTime ? ` (${scanTime}s)` : ''}
              </span>
            </div>
            
            {error && (
              <div style={{ 
                background: 'rgba(255, 107, 107, 0.15)', border: '1px solid rgba(255, 107, 107, 0.3)',
                borderRadius: '10px', padding: '12px', marginBottom: '12px', fontSize: '0.8rem', color: '#ff6b6b'
              }}>
                ⚠️ {error}
              </div>
            )}

            {!selectedMonth && (
              <div style={{
                background: 'rgba(212, 175, 55, 0.12)', border: '1px solid rgba(212, 175, 55, 0.24)',
                borderRadius: '10px', padding: '12px', marginBottom: '12px', fontSize: '0.8rem', color: 'var(--color-gold)'
              }}>
                Selecciona primero el mes y el año del calendario para procesar la imagen.
              </div>
            )}

            {!visionModel && (
              <div style={{
                background: 'rgba(175, 210, 250, 0.12)', border: '1px solid rgba(175, 210, 250, 0.24)',
                borderRadius: '10px', padding: '12px', marginBottom: '12px', fontSize: '0.8rem', color: 'var(--color-accent)'
              }}>
                Este flujo replica el repo origen y requiere el backend `proxy-server.mjs` con `BUILT_IN_FORGE_API_KEY` o `FORGE_API_KEY`.
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
              {parsedShifts.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--color-primary)', zIndex: 10 }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>Fecha</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>Tipo</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>Inicio</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>Fin</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--glass-border)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedShifts.map((s, i) => {
                      const incomplete = s.startTime === '??:??' || s.endTime === '??:??';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: incomplete ? 'rgba(255, 107, 107, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '8px' }}>
                            <input type="text" className="modal-input" value={s.date}
                              onChange={(e) => handleUpdateShift(i, 'date', e.target.value)}
                              style={{ padding: '6px', fontSize: '0.8rem' }} />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input type="text" className="modal-input" value={s.shiftType ?? ''}
                              onChange={(e) => handleUpdateShift(i, 'shiftType', e.target.value)}
                              style={{ padding: '6px', fontSize: '0.8rem' }} />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input type="text" className="modal-input" value={s.startTime}
                              onChange={(e) => handleUpdateShift(i, 'startTime', e.target.value)}
                              style={{ padding: '6px', fontSize: '0.8rem', color: s.startTime === '??:??' ? '#ff6b6b' : 'inherit' }} />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input type="text" className="modal-input" value={s.endTime}
                              onChange={(e) => handleUpdateShift(i, 'endTime', e.target.value)}
                              style={{ padding: '6px', fontSize: '0.8rem', color: s.endTime === '??:??' ? '#ff6b6b' : 'inherit' }} />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button onClick={() => handleRemoveShift(i)} style={{ color: '#ff6b6b', padding: '6px' }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                  <FileImage size={40} />
                  <p style={{ marginTop: '12px' }}>Pulsa "Escanear" para detectar turnos</p>
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px' }}>
              <button 
                className="btn-gold" 
                style={{ width: '100%', height: '48px', fontSize: '1rem' }} 
                disabled={readyShifts.length === 0 || loading}
                onClick={handleConfirm}
              >
                Confirmar Importación ({readyShifts.length}/{parsedShifts.length} listos)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
