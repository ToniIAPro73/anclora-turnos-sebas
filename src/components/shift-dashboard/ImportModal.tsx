import React, { useEffect, useRef, useState } from 'react';
import { Cpu, FileImage, Loader2, Trash2, Upload, X } from 'lucide-react';
import { CalendarImportContext, ParsedCalendarShift, detectMonthYear, extractTextBlocksWithPositions } from '../../lib/calendar-image-parser';
import { EndpointDebugInfo, ExtractUsageMetadata, checkGeminiAvailable, parseCalendarWithGemini } from '../../lib/gemini-vision-parser';
import { detectPdfCalendarContext, parseEmployeeShiftsFromPdf } from '../../lib/pdf-shift-parser';
import { Shift } from '../../lib/types';
import { normalizeShiftTypeLabel } from '../../lib/shifts';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (shifts: Shift[], targetPeriod: CalendarImportContext) => void;
  initialContext: CalendarImportContext;
}

function isFreeShift(shift: Pick<ParsedCalendarShift, 'shiftType'>): boolean {
  return (shift.shiftType ?? '').trim().toLowerCase() === 'libre';
}

function hasImportableShiftData(shift: ParsedCalendarShift): boolean {
  return Boolean((shift.shiftType ?? '').trim()) || (shift.startTime !== '??:??') || (shift.endTime !== '??:??');
}

function getShiftOriginLabel(shift: ParsedCalendarShift, isPdf: boolean): 'IMG' | 'PDF' {
  if (shift.origin === 'PDF') {
    return 'PDF';
  }
  if (shift.origin === 'IMG') {
    return 'IMG';
  }
  return isPdf ? 'PDF' : 'IMG';
}

function hasPreviewedImportState(previewUrl: string | null, parsedShifts: ParsedCalendarShift[]): boolean {
  return Boolean(previewUrl) || parsedShifts.length > 0;
}

export const ImportModal = ({ isOpen, onClose, onConfirmImport, initialContext }: ImportModalProps) => {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedShifts, setParsedShifts] = useState<ParsedCalendarShift[]>([]);
  const [backendModel, setBackendModel] = useState<string | null>(null);
  const [backendEndpointUrl, setBackendEndpointUrl] = useState<string | null>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);
  const [usageMetadata, setUsageMetadata] = useState<ExtractUsageMetadata | null>(null);
  const [endpointDebugInfo, setEndpointDebugInfo] = useState<EndpointDebugInfo | null>(null);
  const [employeeName, setEmployeeName] = useState<string>('Sebastian Pozo Mendoza');
  const [employeeId, setEmployeeId] = useState<string>('84881');
  const [selectedMonth, setSelectedMonth] = useState<string>(String(initialContext.month));
  const [selectedYear, setSelectedYear] = useState<string>(String(initialContext.year));
  const [canStartFreshImport, setCanStartFreshImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPdfFile = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');

  const applyDetectedContext = (context: CalendarImportContext) => {
    setSelectedMonth(String(context.month));
    setSelectedYear(String(context.year));
  };

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
    checkGeminiAvailable().then(({ available, model, reason, endpointUrl }) => {
      setBackendModel(model);
      setBackendEndpointUrl(endpointUrl ?? null);
      if (!available || !model) {
        setError(reason || 'No se pudo preparar la conexion con el endpoint publico de turno-app.');
      }
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setCanStartFreshImport(hasPreviewedImportState(previewUrl, parsedShifts));
    setSelectedMonth(String(initialContext.month));
    setSelectedYear(String(initialContext.year));
  }, [isOpen, initialContext.month, initialContext.year, parsedShifts, previewUrl]);

  const resetImportState = () => {
    setFile(null);
    setPreviewUrl(null);
    setParsedShifts([]);
    setError(null);
    setScanTime(null);
    setUsageMetadata(null);
    setEndpointDebugInfo(null);
    setCanStartFreshImport(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }

    setFile(selected);
    setPreviewUrl(selected.type === 'application/pdf' ? null : URL.createObjectURL(selected));
    setParsedShifts([]);
    setError(null);
    setScanTime(null);
    setUsageMetadata(null);
    setEndpointDebugInfo(null);
  };

  const detectImageCalendarContext = async (imageFile: File): Promise<CalendarImportContext> => {
    const { blocks, rawText } = await extractTextBlocksWithPositions(imageFile);
    return detectMonthYear(rawText, blocks);
  };

  const handleStartImport = async () => {
    if (!file) {
      return;
    }

    setLoading(true);
    setError(null);
    setScanTime(null);
    setUsageMetadata(null);
    setEndpointDebugInfo(null);

    const startedAt = Date.now();
    try {
      const importContext = isPdfFile
        ? await detectPdfCalendarContext(file)
        : await detectImageCalendarContext(file);

      applyDetectedContext(importContext);

      if (isPdfFile) {
        const shifts = await parseEmployeeShiftsFromPdf(file, importContext, {
          employeeName,
          employeeId,
        });

        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        setScanTime(elapsed);
        setParsedShifts(shifts);
        setEndpointDebugInfo(null);
        if (shifts.length === 0) {
          setError('No se detectaron turnos para el empleado indicado dentro del PDF.');
        }
        return;
      }

      if (!backendModel) {
        throw new Error('Este flujo requiere el endpoint publico de turno-app con Gemini 2.5 Flash.');
      }

      const result = await parseCalendarWithGemini(file, importContext);

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      setScanTime(elapsed);
      setUsageMetadata(result.metadata);
      setEndpointDebugInfo(result.debugInfo);

      if (result.shifts.length === 0) {
        setError('No se detectaron turnos. Revisa la consola para más detalles.');
      }

      setParsedShifts(result.shifts);
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
      origin: getShiftOriginLabel(shift, Boolean(isPdfFile)),
    }));

    onConfirmImport(finalShifts, importContext);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const modelLabel = backendModel ?? 'Gemini';
  const rateLimit = usageMetadata?.rateLimit;
  const credits = usageMetadata?.credits;
  const resetDateLabel = rateLimit?.resetDate
    ? new Date(rateLimit.resetDate).toLocaleDateString('es-ES')
    : null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '1420px', width: '96vw', height: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Importador Inteligente</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              className="btn-outline"
              onClick={resetImportState}
              disabled={!canStartFreshImport}
              style={{ padding: '8px 12px', fontWeight: 700, opacity: canStartFreshImport ? 1 : 0.45, cursor: canStartFreshImport ? 'pointer' : 'not-allowed' }}
            >
              Nueva Importación
            </button>
            <button onClick={onClose} style={{ color: 'var(--text-subtle)' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(0, 1fr)', gap: '24px', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Nombre</span>
                <input
                  className="modal-input"
                  type="text"
                  value={employeeName}
                  onChange={(event) => setEmployeeName(event.target.value)}
                  style={{ padding: '10px 12px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>ID</span>
                <input
                  className="modal-input"
                  type="text"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  style={{ padding: '10px 12px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
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

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
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

            <div style={{ display: 'flex', gap: '8px' }}>
              <div
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-gold)',
                  background: 'var(--gold-tint-bg)',
                  color: backendModel ? 'var(--color-gold)' : 'var(--text-muted)',
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

            {backendEndpointUrl && !isPdfFile && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Endpoint activo: <span style={{ color: 'var(--text-primary)' }}>{backendEndpointUrl}</span>
              </div>
            )}

            {usageMetadata && !isPdfFile && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '10px 12px', background: 'var(--panel-muted-bg)' }}>
                  <div style={{ fontSize: '0.72rem', opacity: 0.68, marginBottom: '4px' }}>Coste de esta llamada</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-gold)' }}>{credits?.formattedEur ?? 'n/d'}</div>
                  {credits?.formattedUsd && <div style={{ fontSize: '0.72rem', opacity: 0.58 }}>{credits.formattedUsd}</div>}
                </div>
                <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '10px 12px', background: 'var(--panel-muted-bg)' }}>
                  <div style={{ fontSize: '0.72rem', opacity: 0.68, marginBottom: '4px' }}>Creditos consumidos</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800 }}>{credits?.creditsDifference ?? 'n/d'}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.58 }}>
                    {typeof credits?.creditsAfter === 'number' ? `${credits.creditsAfter} restantes` : 'sin dato'}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '10px 12px', background: 'var(--panel-muted-bg)' }}>
                  <div style={{ fontSize: '0.72rem', opacity: 0.68, marginBottom: '4px' }}>Llamadas del mes</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800 }}>{typeof rateLimit?.callsUsed === 'number' && typeof rateLimit?.monthlyLimit === 'number' ? `${rateLimit.callsUsed}/${rateLimit.monthlyLimit}` : 'n/d'}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.58 }}>
                    {typeof rateLimit?.callsRemaining === 'number' ? `${rateLimit.callsRemaining} disponibles` : 'sin dato'}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '10px 12px', background: 'var(--panel-muted-bg)' }}>
                  <div style={{ fontSize: '0.72rem', opacity: 0.68, marginBottom: '4px' }}>Reinicio del limite</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800 }}>{resetDateLabel ?? 'n/d'}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.58 }}>
                    {usageMetadata.processingTime ? `${(usageMetadata.processingTime / 1000).toFixed(1)}s backend` : 'sin dato'}
                  </div>
                </div>
              </div>
            )}

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
                  event.currentTarget.style.background = 'var(--panel-muted-bg)';
                }}
                onMouseOut={(event) => {
                  event.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '50%' }}>
                  <Upload size={32} color="var(--color-accent)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: '600' }}>Subir imagen o PDF</p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>El modal abre con el mes y el año visibles en el dashboard y puede corregirlos automaticamente al procesar</p>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'var(--preview-bg)' }} />
                <button
                  onClick={resetImportState}
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--danger-bg-strong)', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <Trash2 size={16} color="white" />
                </button>
              </div>
            )}

            {isPdfFile && file && !previewUrl && (
              <div style={{ flex: 1, borderRadius: '16px', border: '1px solid var(--glass-border)', background: 'var(--panel-muted-bg)', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                <FileImage size={36} color="var(--color-accent)" />
                <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{file.name}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.65 }}>Se buscara la fila del empleado y se extraeran los turnos del rango del PDF.</div>
              </div>
            )}

            <input ref={fileInputRef} type="file" hidden accept="image/*,.pdf,application/pdf" onChange={handleFileChange} />

            <button
              className="btn-gold"
              disabled={!file || (!isPdfFile && !backendModel) || loading}
              onClick={handleStartImport}
              style={{ padding: '12px', opacity: !file || (!isPdfFile && !backendModel) || loading ? 0.5 : 1, width: '100%' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  {isPdfFile ? 'Extrayendo PDF...' : `Analizando con ${modelLabel}...`}
                </span>
              ) : isPdfFile ? 'Importar PDF' : 'Escanear Imagen'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--panel-muted-bg)', borderRadius: '16px', padding: '16px', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-accent)' }}>Turnos Detectados</h3>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                {parsedShifts.length} encontrados{scanTime ? ` (${scanTime}s)` : ''}
              </span>
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '12px',
                  fontSize: '0.8rem',
                  color: 'var(--danger)',
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {endpointDebugInfo && (
              <div
                style={{
                  background: 'var(--gold-tint-bg)',
                  border: '1px solid var(--color-gold)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '12px',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: '8px', color: 'var(--color-gold)' }}>
                  Respuesta bruta del endpoint para dias sensibles
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '132px', overflowY: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}>
                  {endpointDebugInfo.candidates.map((candidate, index) => (
                    <div key={`${candidate.day}-${index}`}>
                      {`día ${candidate.day} | tipo=${candidate.shiftType ?? '-'} | inicio=${candidate.startTime ?? '-'} | fin=${candidate.endTime ?? '-'} | mes=${candidate.month ?? '-'} | año=${candidate.year ?? '-'}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!backendModel && (
              <div
                style={{
                  background: 'var(--info-bg)',
                  border: '1px solid var(--info-border)',
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

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px', minHeight: 0 }}>
              {parsedShifts.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--table-head-bg)', zIndex: 10 }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>Fecha</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>Origen</th>
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
                        <tr key={index} style={{ borderBottom: '1px solid var(--border-soft)', background: incomplete ? 'var(--danger-row-bg)' : 'transparent' }}>
                          <td style={{ padding: '8px' }}>
                            <input type="text" className="modal-input" value={shift.date} onChange={(event) => handleUpdateShift(index, 'date', event.target.value)} style={{ padding: '6px', fontSize: '0.8rem' }} />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input type="text" className="modal-input" value={getShiftOriginLabel(shift, Boolean(isPdfFile))} readOnly style={{ padding: '6px', fontSize: '0.8rem', opacity: 0.85 }} />
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
                              style={{ padding: '6px', fontSize: '0.8rem', color: !isLibre && shift.startTime === '??:??' ? 'var(--danger)' : 'inherit' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="text"
                              className="modal-input"
                              value={isLibre && shift.endTime === '??:??' ? '' : shift.endTime}
                              onChange={(event) => handleUpdateShift(index, 'endTime', event.target.value)}
                              style={{ padding: '6px', fontSize: '0.8rem', color: !isLibre && shift.endTime === '??:??' ? 'var(--danger)' : 'inherit' }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button onClick={() => handleRemoveShift(index)} style={{ color: 'var(--danger)', padding: '6px' }}>
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
