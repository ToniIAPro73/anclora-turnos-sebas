import { useState, useEffect, useMemo } from 'react';
import { Shift } from './types/shift';
import { getMonday, formatISO } from './lib/date-utils';
import { loadShifts, saveShifts } from './lib/storage';
import { StatsBar } from './components/shift-dashboard/StatsBar';
import { WeekHeader } from './components/shift-dashboard/WeekHeader';
import { WeekGrid } from './components/shift-dashboard/WeekGrid';
import { ShiftModal } from './components/shift-dashboard/ShiftModal';

function App() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(formatISO(getMonday(new Date())));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  // Load shifts on mount
  useEffect(() => {
    const saved = loadShifts();
    setShifts(saved);
  }, []);

  // Save shifts on change
  useEffect(() => {
    saveShifts(shifts);
  }, [shifts]);

  const currentWeekShifts = useMemo(() => {
    const monday = new Date(currentWeekStart);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);
    const sundayISO = formatISO(sunday);

    return shifts.filter(s => s.date >= currentWeekStart && s.date < sundayISO);
  }, [shifts, currentWeekStart]);

  const editingShift = useMemo(() => 
    shifts.find(s => s.id === editingShiftId) || null
  , [shifts, editingShiftId]);

  const handleSaveShift = (newShift: Shift) => {
    if (editingShiftId) {
      setShifts(shifts.map(s => s.id === editingShiftId ? newShift : s));
    } else {
      setShifts([...shifts, newShift]);
    }
    setIsModalOpen(false);
    setEditingShiftId(null);
  };

  const handleDeleteShift = (id: string) => {
    setShifts(shifts.filter(s => s.id !== id));
    setIsModalOpen(false);
    setEditingShiftId(null);
  };

  const handleEditShift = (id: string) => {
    setEditingShiftId(id);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingShiftId(null);
    setIsModalOpen(true);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-lg)' }}>
      <WeekHeader 
        currentWeekStart={currentWeekStart} 
        onNavigate={setCurrentWeekStart}
        onAddShift={handleOpenAdd}
      />

      <StatsBar 
        shifts={shifts} 
        currentWeekShifts={currentWeekShifts} 
      />

      <div className="card" style={{ padding: 'var(--space-md)', background: 'var(--surface)' }}>
        <WeekGrid 
          currentWeekStart={currentWeekStart} 
          shifts={shifts} 
          onEditShift={handleEditShift}
        />
      </div>

      <ShiftModal 
        isOpen={isModalOpen}
        editingShift={editingShift}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveShift}
        onDelete={handleDeleteShift}
      />
    </div>
  );
}

export default App;
