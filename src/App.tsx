import { useState, useEffect, useMemo } from 'react';
import { Shift } from './lib/types';
import { getMonthDaysISO, getDaysInMonth } from './lib/week';
import { loadShifts, saveShifts } from './lib/storage';
import { getShiftType, hasShiftTimes } from './lib/shifts';
import { StatsBar } from './components/shift-dashboard/StatsBar';
import { MonthHeader } from './components/shift-dashboard/MonthHeader';
import { MonthGrid } from './components/shift-dashboard/MonthGrid';
import { ShiftModal } from './components/shift-dashboard/ShiftModal';
import { ImportModal } from './components/shift-dashboard/ImportModal';
import { CalendarImportContext } from './lib/calendar-image-parser';

function normalizeShiftDate(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    return trimmed;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizeShift(shift: Shift): Shift {
  return {
    ...shift,
    date: normalizeShiftDate(shift.date),
    startTime: shift.startTime.trim(),
    endTime: shift.endTime.trim(),
    location: shift.location.trim(),
  };
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function timeRangesOverlap(left: Shift, right: Shift): boolean {
  if (!hasShiftTimes(left) || !hasShiftTimes(right)) {
    return false;
  }

  const leftStart = parseTimeToMinutes(left.startTime);
  const leftEnd = parseTimeToMinutes(left.endTime) <= leftStart
    ? parseTimeToMinutes(left.endTime) + (24 * 60)
    : parseTimeToMinutes(left.endTime);
  const rightStart = parseTimeToMinutes(right.startTime);
  const rightEnd = parseTimeToMinutes(right.endTime) <= rightStart
    ? parseTimeToMinutes(right.endTime) + (24 * 60)
    : parseTimeToMinutes(right.endTime);

  const intervals: Array<[number, number]> = [
    [leftStart, leftEnd],
    [leftStart + (24 * 60), leftEnd + (24 * 60)],
  ];
  const candidates: Array<[number, number]> = [
    [rightStart, rightEnd],
    [rightStart + (24 * 60), rightEnd + (24 * 60)],
  ];

  return intervals.some(([aStart, aEnd]) =>
    candidates.some(([bStart, bEnd]) => aStart < bEnd && bStart < aEnd));
}

function findShiftConflict(current: Shift[], incoming: Shift): string | null {
  const normalizedIncoming = normalizeShift(incoming);
  const incomingType = getShiftType(normalizedIncoming);
  const comparable = current.filter((shift) => shift.id !== normalizedIncoming.id && shift.date === normalizedIncoming.date);
  const exclusiveTypes = new Set(['JT', 'Regular', 'Libre']);

  const sameType = comparable.find((shift) => getShiftType(shift) === incomingType);
  if (sameType) {
    return `Ya existe un turno de tipo ${incomingType} en ${normalizedIncoming.date}. Puedes modificar manualmente el turno existente.`;
  }

  if (incomingType === 'Extras' && hasShiftTimes(normalizedIncoming)) {
    const overlapping = comparable.find((shift) => hasShiftTimes(shift) && timeRangesOverlap(shift, normalizedIncoming));
    if (overlapping) {
      return `El turno Extras se solapa con el turno ${getShiftType(overlapping)} de ${normalizedIncoming.date}. Corrigelo antes de añadirlo.`;
    }
  }

  if (exclusiveTypes.has(incomingType)) {
    const incompatible = comparable.find((shift) => {
      const existingType = getShiftType(shift);
      return exclusiveTypes.has(existingType) && existingType !== incomingType;
    });

    if (incompatible) {
      return `No puedes combinar ${incomingType} con ${getShiftType(incompatible)} en ${normalizedIncoming.date}. JT, Regular y Libre son excluyentes.`;
    }
  }

  return null;
}

function insertShift(current: Shift[], incoming: Shift): Shift[] {
  return [...current.filter((shift) => shift.id !== incoming.id), normalizeShift(incoming)];
}

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
    const conflict = findShiftConflict(shifts, shift);
    if (conflict) {
      window.alert(conflict);
      return;
    }

    if (editingShiftId) {
      setShifts((current) => insertShift(current, shift));
    } else {
      setShifts((current) => insertShift(current, shift));
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

  const handleConfirmImport = (newShifts: Shift[], targetPeriod: CalendarImportContext) => {
    setShifts((current) => {
      const accepted = [...current];
      const conflicts: string[] = [];

      for (const shift of newShifts) {
        const conflict = findShiftConflict(accepted, shift);
        if (conflict) {
          conflicts.push(conflict);
          continue;
        }

        accepted.push(normalizeShift(shift));
      }

      if (conflicts.length > 0) {
        const summary = conflicts.length === 1
          ? conflicts[0]
          : `${conflicts.length} turnos no se importaron:\n- ${conflicts.join('\n- ')}`;
        window.alert(summary);
      }

      return accepted;
    });
    setCurrentYear(targetPeriod.year);
    setCurrentMonth(targetPeriod.month);
    setIsImportOpen(false);
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
        onConfirmImport={handleConfirmImport}
      />
    </div>
  );
}

export default App;
