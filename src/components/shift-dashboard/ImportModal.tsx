import React, { useState, useRef } from 'react';
import { X, Upload, FileImage, Loader2, Trash2 } from 'lucide-react';
import { extractTextBlocksWithPositions, detectMonthYear, processCalendarData, ParsedCalendarShift } from '../../lib/calendar-image-parser';
import { Shift } from '../../lib/types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (shifts: Shift[]) => void;
}

export const ImportModal = ({ isOpen, onClose, onConfirmImport }: ImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedShifts, setParsedShifts] = useState<ParsedCalendarShift[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setParsedShifts([]);
      setError(null);
    }
  };

  const handleStartOCR = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      console.log('[ImportModal] Starting OCR for file:', file.name, 'size:', file.size);
      const ocrResult = await extractTextBlocksWithPositions(file);
      const { blocks, rawText } = ocrResult;
      const supplementaryText = (ocrResult as any).supplementaryText as string | undefined;
      console.log('[ImportModal] OCR complete. Blocks:', blocks.length, 'Text length:', rawText.length);

      if (!rawText && blocks.length === 0) {
        setError('El OCR no pudo extraer texto de la imagen. Intenta con una imagen más nítida.');
        setLoading(false);
        return;
      }

      const { month, year } = detectMonthYear(rawText, blocks);
      console.log('[ImportModal] Month:', month, 'Year:', year);

      const shifts = processCalendarData(blocks, rawText, month, year, supplementaryText);
      console.log('[ImportModal] Parsed shifts:', shifts.length);

      if (shifts.length === 0) {
        setError(`OCR completado (${rawText.length} caracteres) pero no se detectaron patrones de turno. Revisa la consola para más detalles.`);
      }

      setParsedShifts(shifts);
    } catch (err: any) {
      console.error('[ImportModal] OCR Error:', err);
      setError(`Error OCR: ${err?.message || 'Error desconocido'}`);
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

  const handleConfirm = () => {
    const finalShifts: Shift[] = parsedShifts
      .filter(s => s.startTime !== '??:??' && s.endTime !== '??:??')
      .map(s => ({
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

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '1000px', width: '95%', height: '85vh', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', color: 'rgba(245, 245, 240, 0.4)' }}>
          <X size={24} />
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '24px' }}>Importador Inteligente</h2>

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
                  onClick={() => { setFile(null); setPreviewUrl(null); setParsedShifts([]); setError(null); }}
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
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Analizando...
                </span>
              ) : 'Escanear Imagen'}
            </button>
          </div>

          {/* Right: Detected Data Table (Editable) */}
          <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-accent)' }}>Turnos Detectados</h3>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{parsedShifts.length} encontrados</span>
            </div>
            
            {/* Error / Warning display */}
            {error && (
              <div style={{ 
                background: 'rgba(255, 107, 107, 0.15)', border: '1px solid rgba(255, 107, 107, 0.3)',
                borderRadius: '10px', padding: '12px', marginBottom: '12px', fontSize: '0.8rem', color: '#ff6b6b'
              }}>
                ⚠️ {error}
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
                    {parsedShifts.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '8px' }}>
                          <input type="text" className="modal-input" value={s.date}
                            onChange={(e) => handleUpdateShift(i, 'date', e.target.value)}
                            style={{ padding: '6px', fontSize: '0.8rem' }} />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input type="text" className="modal-input" value={s.startTime}
                            onChange={(e) => handleUpdateShift(i, 'startTime', e.target.value)}
                            style={{ padding: '6px', fontSize: '0.8rem' }} />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input type="text" className="modal-input" value={s.endTime}
                            onChange={(e) => handleUpdateShift(i, 'endTime', e.target.value)}
                            style={{ padding: '6px', fontSize: '0.8rem' }} />
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button onClick={() => handleRemoveShift(i)} style={{ color: '#ff6b6b', padding: '6px' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
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
                disabled={parsedShifts.length === 0 || loading}
                onClick={handleConfirm}
              >
                Confirmar Importación ({parsedShifts.filter(s => s.startTime !== '??:??' && s.endTime !== '??:??').length}/{parsedShifts.length} listos)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
