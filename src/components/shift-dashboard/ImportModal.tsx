import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileImage, Loader2, Trash2, Cpu, ScanLine } from 'lucide-react';
import { ParsedCalendarShift, parseCalendarImageWithTesseract } from '../../lib/calendar-image-parser';
import { checkOllamaAvailable, parseCalendarWithOllama } from '../../lib/ollama-vision-parser';
import { Shift } from '../../lib/types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (shifts: Shift[]) => void;
}

type OcrEngine = 'vision' | 'tesseract';

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getYearMonth(date: string): string | null {
  return isIsoDate(date) ? date.slice(0, 7) : null;
}

function pickDominantMonth(shifts: ParsedCalendarShift[]): string | null {
  const counts = new Map<string, number>();

  for (const shift of shifts) {
    const yearMonth = getYearMonth(shift.date);
    if (!yearMonth) {
      continue;
    }
    counts.set(yearMonth, (counts.get(yearMonth) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [yearMonth, count] of counts.entries()) {
    if (count > bestCount) {
      best = yearMonth;
      bestCount = count;
    }
  }

  return best;
}

function sanitizeMonthScope(shifts: ParsedCalendarShift[], preferredMonth?: string | null): ParsedCalendarShift[] {
  const targetMonth = preferredMonth ?? pickDominantMonth(shifts);
  if (!targetMonth) {
    return shifts;
  }

  return shifts.filter((shift) => getYearMonth(shift.date) === targetMonth);
}

function scoreShifts(shifts: ParsedCalendarShift[]): number {
  return shifts.reduce((total, shift) => {
    const complete = shift.startTime !== '??:??' && shift.endTime !== '??:??';
    return total + (complete ? 4 : 1) + Math.round(shift.confidence * 10);
  }, 0);
}

function countCompleteShifts(shifts: ParsedCalendarShift[]): number {
  return shifts.filter((shift) => shift.startTime !== '??:??' && shift.endTime !== '??:??').length;
}

function mergeParsedShifts(primary: ParsedCalendarShift[], secondary: ParsedCalendarShift[]): ParsedCalendarShift[] {
  const byDate = new Map<string, ParsedCalendarShift>();

  for (const shift of primary) {
    byDate.set(shift.date, shift);
  }

  for (const shift of secondary) {
    const existing = byDate.get(shift.date);
    if (!existing) {
      byDate.set(shift.date, shift);
      continue;
    }

    byDate.set(shift.date, {
      ...existing,
      startTime: existing.startTime === '??:??' && shift.startTime !== '??:??' ? shift.startTime : existing.startTime,
      endTime: existing.endTime === '??:??' && shift.endTime !== '??:??' ? shift.endTime : existing.endTime,
      isValid: existing.isValid || shift.isValid,
      confidence: Math.max(existing.confidence, shift.confidence),
      rawText: `${existing.rawText} || ${shift.rawText}`,
    });
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export const ImportModal = ({ isOpen, onClose, onConfirmImport }: ImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedShifts, setParsedShifts] = useState<ParsedCalendarShift[]>([]);
  const [engine, setEngine] = useState<OcrEngine>('vision');
  const [visionModel, setVisionModel] = useState<string | null>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Ollama availability on mount
  useEffect(() => {
    checkOllamaAvailable().then(({ available, model }) => {
      setVisionModel(model);
      if (!available || !model) setEngine('tesseract');
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
    if (!file) return;
    setLoading(true);
    setError(null);
    setScanTime(null);
    const t0 = Date.now();

    try {
      let shifts: ParsedCalendarShift[];

      if (engine === 'vision' && visionModel) {
        console.log(`[ImportModal] Using Vision Model: ${visionModel}`);
        const [visionResult, ocrResult] = await Promise.allSettled([
          parseCalendarWithOllama(file, visionModel),
          parseCalendarImageWithTesseract(file),
        ]);

        const visionShifts = visionResult.status === 'fulfilled' ? visionResult.value : [];
        const ocrShifts = ocrResult.status === 'fulfilled' ? ocrResult.value : [];
        const visionError = visionResult.status === 'rejected'
          ? String(visionResult.reason?.message || visionResult.reason || '')
          : '';

        if (visionResult.status === 'rejected') {
          console.warn('[ImportModal] Vision result rejected, falling back to OCR:', visionResult.reason);
        }
        if (ocrResult.status === 'rejected') {
          console.warn('[ImportModal] OCR result rejected:', ocrResult.reason);
        }

        if (visionShifts.length === 0 && ocrShifts.length === 0) {
          throw new Error('No se pudo obtener una lectura valida ni con IA local ni con OCR.');
        }

        const dominantMonth = pickDominantMonth(visionShifts) ?? pickDominantMonth(ocrShifts);
        const scopedVisionShifts = sanitizeMonthScope(visionShifts, dominantMonth);
        const scopedOcrShifts = sanitizeMonthScope(ocrShifts, dominantMonth);

        const visionScore = scoreShifts(scopedVisionShifts);
        const ocrScore = scoreShifts(scopedOcrShifts);
        const visionComplete = countCompleteShifts(scopedVisionShifts);
        const ocrComplete = countCompleteShifts(scopedOcrShifts);
        const primary = visionScore >= ocrScore ? scopedVisionShifts : scopedOcrShifts;
        const secondary = visionScore >= ocrScore ? scopedOcrShifts : scopedVisionShifts;

        console.log('[ImportModal] Vision score:', visionScore, 'OCR score:', ocrScore);

        const strongOcrLead =
          ocrScore >= visionScore * 1.5 ||
          ocrComplete >= visionComplete + 5;

        shifts = strongOcrLead
          ? scopedOcrShifts
          : (primary.length > 0 ? mergeParsedShifts(primary, secondary) : secondary);

        if (visionError && shifts === scopedOcrShifts) {
          setError(`Vision local no disponible: ${visionError}`);
        }
      } else {
        console.log('[ImportModal] Using Tesseract.js OCR');
        shifts = sanitizeMonthScope(await parseCalendarImageWithTesseract(file));
      }

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
    const finalShifts: Shift[] = readyShifts.map(s => ({
      id: crypto.randomUUID(),
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      location: 'Importado (OCR)'
    }));
    onConfirmImport(finalShifts);
    onClose();
  };

  if (!isOpen) return null;

  const modelLabel = visionModel?.split(':')[0] || 'Vision';

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '1000px', width: '95%', height: '85vh', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', color: 'rgba(245, 245, 240, 0.4)' }}>
          <X size={24} />
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '16px' }}>Importador Inteligente</h2>

        {/* Engine toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => setEngine('vision')}
            disabled={!visionModel}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid',
              borderColor: engine === 'vision' ? 'var(--color-gold)' : 'var(--glass-border)',
              background: engine === 'vision' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: engine === 'vision' ? 'var(--color-gold)' : 'rgba(245,245,240,0.4)',
              cursor: visionModel ? 'pointer' : 'not-allowed',
              opacity: visionModel ? 1 : 0.4,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase',
            }}
          >
            <Cpu size={14} />
            {visionModel ? `${modelLabel} (IA Local)` : 'Qwen Vision no instalado'}
          </button>
          <button
            onClick={() => setEngine('tesseract')}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid',
              borderColor: engine === 'tesseract' ? 'var(--color-accent)' : 'var(--glass-border)',
              background: engine === 'tesseract' ? 'rgba(175, 210, 250, 0.15)' : 'transparent',
              color: engine === 'tesseract' ? 'var(--color-accent)' : 'rgba(245,245,240,0.4)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase',
            }}
          >
            <ScanLine size={14} />
            Tesseract OCR
          </button>
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
              disabled={!file || loading} 
              onClick={handleStartOCR}
              style={{ padding: '12px', opacity: !file || loading ? 0.5 : 1, width: '100%' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  {engine === 'vision' ? `Analizando con ${modelLabel}...` : 'Analizando...'}
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

            {!visionModel && engine === 'tesseract' && (
              <div style={{
                background: 'rgba(175, 210, 250, 0.12)', border: '1px solid rgba(175, 210, 250, 0.24)',
                borderRadius: '10px', padding: '12px', marginBottom: '12px', fontSize: '0.8rem', color: 'var(--color-accent)'
              }}>
                Instala un modelo Qwen de vision en Ollama, por ejemplo `qwen3-vl`, `qwen2-vl:7b` o `qwen2-vl:2b`.
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
              {parsedShifts.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--color-primary)', zIndex: 10 }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>Fecha</th>
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
