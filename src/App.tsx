import { useState, useEffect, useMemo } from 'react';
import { Shift } from './lib/types';
import { getWeekStartMonday, toISODate } from './lib/week';
import { loadShifts, saveShifts } from './lib/storage';
import { StatsBar } from './components/shift-dashboard/StatsBar';
import { WeekHeader } from './components/shift-dashboard/WeekHeader';
import { WeekGrid } from './components/shift-dashboard/WeekGrid';
import { ShiftModal } from './components/shift-dashboard/ShiftModal';

function App() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(toISODate(getWeekStartMonday(new Date())));
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
    const sundayISO = toISODate(sunday);

    return shifts.filter(s => s.date >= currentWeekStart && s.date < sundayISO);
  }, [shifts, currentWeekStart]);

  const editingShift = useMemo(() => 
    shifts.find(s => s.id === editingShiftId) || null
  , [shifts, editingShiftId]);

  const handleSaveShift = (shift: Shift) => {
    if (editingShiftId) {
      setShifts(shifts.map(s => s.id === shift.id ? shift : s));
    } else {
      setShifts([...shifts, shift]);
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

  return (
    <div className="container">
      <WeekHeader 
        currentWeekStart={currentWeekStart}
        onNavigate={setCurrentWeekStart}
        onAddShift={() => {
          setEditingShiftId(null);
          setIsModalOpen(true);
        }}
      />
      
      <StatsBar 
        shifts={shifts}
        currentWeekShifts={currentWeekShifts}
      />

      <WeekGrid 
        currentWeekStart={currentWeekStart}
        shifts={currentWeekShifts}
        onEditShift={handleEditShift}
      />

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
