import { useState, useEffect, useMemo } from 'react';
import { Shift } from './lib/types';
import { getMonthDaysISO, getDaysInMonth } from './lib/week';
import { loadShifts, saveShifts } from './lib/storage';
import { StatsBar } from './components/shift-dashboard/StatsBar';
import { MonthHeader } from './components/shift-dashboard/MonthHeader';
import { MonthGrid } from './components/shift-dashboard/MonthGrid';
import { ShiftModal } from './components/shift-dashboard/ShiftModal';
import { ImportModal } from './components/shift-dashboard/ImportModal';

function App() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  useEffect(() => {
    setShifts(loadShifts());
  }, []);

  useEffect(() => {
    saveShifts(shifts);
  }, [shifts]);

  const monthDays = useMemo(() => getMonthDaysISO(currentYear, currentMonth), [currentYear, currentMonth]);
  const daysInMonth = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);

  const currentMonthShifts = useMemo(() => {
    const firstDay = monthDays[0];
    const lastDay = monthDays[monthDays.length - 1];
    return shifts.filter(s => s.date >= firstDay && s.date <= lastDay);
  }, [shifts, monthDays]);

  const editingShift = useMemo(() =>
    shifts.find(s => s.id === editingShiftId) || null
  , [shifts, editingShiftId]);

  const handleNavigate = (delta: number) => {
    const d = new Date(currentYear, currentMonth + delta, 1);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
  };

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
      <MonthHeader
        year={currentYear}
        month={currentMonth}
        onNavigate={handleNavigate}
        onAddShift={() => {
          setEditingShiftId(null);
          setIsModalOpen(true);
        }}
        onImport={() => setIsImportOpen(true)}
      />

      <StatsBar
        shifts={shifts}
        currentMonthShifts={currentMonthShifts}
        daysInMonth={daysInMonth}
      />

      <MonthGrid
        year={currentYear}
        month={currentMonth}
        shifts={currentMonthShifts}
        onEditShift={handleEditShift}
      />

      <ShiftModal
        isOpen={isModalOpen}
        editingShift={editingShift}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveShift}
        onDelete={handleDeleteShift}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onConfirmImport={(newShifts) => setShifts([...shifts, ...newShifts])}
      />
    </div>
  );
}

export default App;
