import React, { useEffect, useRef, useState } from 'react';
import { Cpu, FileImage, Loader2, Trash2, Upload, X } from 'lucide-react';
import { CalendarImportContext, ParsedCalendarShift, extractTextFromImageWithTesseract } from '../../lib/calendar-image-parser';
import { checkGeminiAvailable, parseCalendarTextWithGemini, parseCalendarWithGemini } from '../../lib/gemini-vision-parser';
import { Shift } from '../../lib/types';
import { normalizeShiftTypeLabel } from '../../lib/shifts';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (shifts: Shift[], targetPeriod: CalendarImportContext) => void;
}

function isFreeShift(shift: Pick<ParsedCalendarShift, 'shiftType'>): boolean {
  return (shift.shiftType ?? '').trim().toLowerCase() === 'libre';
}

function hasImportableShiftData(shift: ParsedCalendarShift): boolean {
  return Boolean((shift.shiftType ?? '').trim()) || (shift.startTime !== '??:??') || (shift.endTime !== '??:??');
}

export const ImportModal = ({ isOpen, onClose, onConfirmImport }: ImportModalProps) => {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedShifts, setParsedShifts] = useState<ParsedCalendarShift[]>([]);
  const [backendModel, setBackendModel] = useState<string | null>(null);
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

  useEffect(() => {
    checkGeminiAvailable().then(({ available, model }) => {
      setBackendModel(model);
      if (!available || !model) {
        setError('No se pudo preparar la conexion con el endpoint publico de turno-app.');
      }
    });
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setParsedShifts([]);
    setError(null);
    setScanTime(null);
  };

  const handleStartImport = async () => {
    if (!file || !selectedMonth || !selectedYear) {
      return;
    }

    setLoading(true);
    setError(null);
    setScanTime(null);

    const startedAt = Date.now();
    const importContext: CalendarImportContext = {
      month: Number.parseInt(selectedMonth, 10),
      year: Number.parseInt(selectedYear, 10),
    };
    try {
      if (!backendModel) {
        throw new Error('Este flujo requiere el endpoint publico de turno-app con Gemini 2.5 Flash.');
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

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      setScanTime(elapsed);

      if (shifts.length === 0) {
        setError('No se detectaron turnos. Revisa la consola para más detalles.');
      }

      setParsedShifts(shifts);
    } catch (importError: any) {
      console.error('[ImportModal] Error:', importError);
      setError(`Error: ${importError?.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShift = (index: number, field: keyof ParsedCalendarShift, value: string) => {
    const nextShifts = [...parsedShifts];
    nextShifts[index] = { ...nextShifts[index], [field]: value };
    setParsedShifts(nextShifts);
  };

  const handleRemoveShift = (index: number) => {
    setParsedShifts(parsedShifts.filter((_, currentIndex) => currentIndex !== index));
  };

  const readyShifts = parsedShifts.filter(hasImportableShiftData);

  const handleConfirm = () => {
    const importContext: CalendarImportContext = {
      month: Number.parseInt(selectedMonth, 10),
      year: Number.parseInt(selectedYear, 10),
    };

    const finalShifts: Shift[] = readyShifts.map((shift) => ({
      id: crypto.randomUUID(),
      date: shift.date,
      startTime: shift.startTime === '??:??' ? '' : shift.startTime,
      endTime: shift.endTime === '??:??' ? '' : shift.endTime,
      location: normalizeShiftTypeLabel(shift.shiftType ?? '') || 'Regular',
    }));

    onConfirmImport(finalShifts, importContext);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const modelLabel = backendModel ?? 'Gemini';

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
            <select className="modal-input" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} style={{ padding: '10px 12px' }}>
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
            <select className="modal-input" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} style={{ padding: '10px 12px' }}>
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
              color: backendModel ? 'var(--color-gold)' : 'rgba(245,245,240,0.55)',
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
            {backendModel ? `${modelLabel} | turno-app publico` : 'Endpoint no disponible'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr', gap: '24px', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            {!previewUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1,
                  border: '2px dashed var(--glass-border)',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  gap: '12px',
                }}
                onMouseOver={(event) => {
                  event.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseOut={(event) => {
                  event.currentTarget.style.background = 'transparent';
                }}
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
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setParsedShifts([]);
                    setError(null);
                    setScanTime(null);
                  }}
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,0,0,0.5)', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <Trash2 size={16} color="white" />
                </button>
              </div>
            )}

            <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleFileChange} />

            <button
              className="btn-gold"
              disabled={!file || !selectedMonth || !selectedYear || !backendModel || loading}
              onClick={handleStartImport}
              style={{ padding: '12px', opacity: !file || !selectedMonth || !selectedYear || !backendModel || loading ? 0.5 : 1, width: '100%' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  {`Analizando con ${modelLabel}...`}
                </span>
              ) : 'Escanear Imagen'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-accent)' }}>Turnos Detectados</h3>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                {parsedShifts.length} encontrados{scanTime ? ` (${scanTime}s)` : ''}
              </span>
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(255, 107, 107, 0.15)',
                  border: '1px solid rgba(255, 107, 107, 0.3)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '12px',
                  fontSize: '0.8rem',
                  color: '#ff6b6b',
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {!selectedMonth && (
              <div
                style={{
                  background: 'rgba(212, 175, 55, 0.12)',
                  border: '1px solid rgba(212, 175, 55, 0.24)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '12px',
                  fontSize: '0.8rem',
                  color: 'var(--color-gold)',
                }}
              >
                Selecciona primero el mes y el año del calendario para procesar la imagen.
              </div>
            )}

            {!backendModel && (
              <div
                style={{
                  background: 'rgba(175, 210, 250, 0.12)',
                  border: '1px solid rgba(175, 210, 250, 0.24)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '12px',
                  fontSize: '0.8rem',
                  color: 'var(--color-accent)',
                }}
              >
                Este flujo replica el repo origen usando su endpoint publico de extraccion.
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
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--glass-border)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {parsedShifts.map((shift, index) => {
                      const isLibre = isFreeShift(shift);
                      const incomplete = !isLibre && (shift.startTime === '??:??' || shift.endTime === '??:??');
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: incomplete ? 'rgba(255, 107, 107, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '8px' }}>
                            <input type="text" className="modal-input" value={shift.date} onChange={(event) => handleUpdateShift(index, 'date', event.target.value)} style={{ padding: '6px', fontSize: '0.8rem' }} />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input type="text" className="modal-input" value={shift.shiftType ?? ''} onChange={(event) => handleUpdateShift(index, 'shiftType', event.target.value)} style={{ padding: '6px', fontSize: '0.8rem' }} />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="text"
                              className="modal-input"
                              value={isLibre && shift.startTime === '??:??' ? '' : shift.startTime}
                              onChange={(event) => handleUpdateShift(index, 'startTime', event.target.value)}
                              style={{ padding: '6px', fontSize: '0.8rem', color: !isLibre && shift.startTime === '??:??' ? '#ff6b6b' : 'inherit' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="text"
                              className="modal-input"
                              value={isLibre && shift.endTime === '??:??' ? '' : shift.endTime}
                              onChange={(event) => handleUpdateShift(index, 'endTime', event.target.value)}
                              style={{ padding: '6px', fontSize: '0.8rem', color: !isLibre && shift.endTime === '??:??' ? '#ff6b6b' : 'inherit' }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button onClick={() => handleRemoveShift(index)} style={{ color: '#ff6b6b', padding: '6px' }}>
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
              <button className="btn-gold" style={{ width: '100%', height: '48px', fontSize: '1rem' }} disabled={readyShifts.length === 0 || loading} onClick={handleConfirm}>
                Confirmar Importación ({readyShifts.length}/{parsedShifts.length} listos)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
