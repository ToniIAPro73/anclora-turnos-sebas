import React, { useState, useEffect } from 'react';
import { Shift } from '../../types/shift';
import { X, Trash2 } from 'lucide-react';

interface ShiftModalProps {
  isOpen: boolean;
  editingShift: Shift | null;
  onClose: () => void;
  onSave: (shift: Shift) => void;
  onDelete?: (id: string) => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, editingShift, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState<Shift>({
    id: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '14:00',
    location: ''
  });

  useEffect(() => {
    if (editingShift) {
      setFormData(editingShift);
    } else {
      setFormData({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        startTime: '08:00',
        endTime: '15:00',
        location: ''
      });
    }
  }, [editingShift, isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)' 
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-lg)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)', color: 'var(--text-muted)' }}>
          <X size={24} />
        </button>

        <h2 style={{ marginBottom: 'var(--space-lg)', fontSize: '1.25rem' }}>
          {editingShift ? 'Editar Turno' : 'Nuevo Turno'}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>Fecha</label>
            <input 
              type="date" 
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
              style={{ width: '100%', padding: 'var(--space-sm)', borderRadius: 'var(--radius)', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>Inicio</label>
              <input 
                type="time" 
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
                style={{ width: '100%', padding: 'var(--space-sm)', borderRadius: 'var(--radius)', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>Fin</label>
              <input 
                type="time" 
                value={formData.endTime}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
                style={{ width: '100%', padding: 'var(--space-sm)', borderRadius: 'var(--radius)', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>Ubicación</label>
            <input 
              type="text" 
              placeholder="Ej: Oficina Central"
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
              style={{ width: '100%', padding: 'var(--space-sm)', borderRadius: 'var(--radius)', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => onSave(formData)}>
              Guardar
            </button>
            {editingShift && onDelete && (
              <button 
                onClick={() => onDelete(formData.id)}
                style={{ padding: 'var(--space-sm)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)' }}
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
