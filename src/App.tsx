import { useState, useEffect, useMemo } from 'react';
import { Shift } from './lib/types';
import { getMonthDaysISO, getDaysInMonth } from './lib/week';
import { loadShifts, syncShiftChanges } from './lib/storage';
import { getShiftOrigin, getShiftType, hasShiftTimes } from './lib/shifts';
import { StatsBar } from './components/shift-dashboard/StatsBar';
import { MonthHeader } from './components/shift-dashboard/MonthHeader';
import { MonthGrid } from './components/shift-dashboard/MonthGrid';
import { ShiftModal } from './components/shift-dashboard/ShiftModal';
import { ImportModal } from './components/shift-dashboard/ImportModal';
import { CalendarImportContext } from './lib/import-types';

type ThemeMode = 'system' | 'light' | 'dark';

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
    origin: shift.origin === 'PDF' ? 'PDF' : 'MAN',
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
  const incomingOrigin = getShiftOrigin(normalizedIncoming);
  const comparable = current.filter(
    (shift) =>
      shift.id !== normalizedIncoming.id &&
      shift.date === normalizedIncoming.date &&
      getShiftOrigin(shift) === incomingOrigin,
  );

  const sameType = comparable.find(
    (shift) => getShiftType(shift) === incomingType && incomingType !== 'Extras',
  );
  if (sameType) {
    return `Ya existe un turno de tipo ${incomingType} en ${normalizedIncoming.date}. Puedes modificar manualmente el turno existente.`;
  }

  if (incomingType === 'Libre') {
    const incompatible = comparable.find((shift) => {
      const existingType = getShiftType(shift);
      return existingType === 'Regular' || existingType === 'JT' || existingType === 'Libre';
    });

    if (incompatible) {
      return `No puedes añadir Libre si ya existe un turno ${getShiftType(incompatible)} en ${normalizedIncoming.date}.`;
    }
  }

  if (incomingType === 'Regular' || incomingType === 'JT') {
    const incompatible = comparable.find((shift) => getShiftType(shift) === 'Libre');

    if (incompatible) {
      return `No puedes combinar ${incomingType} con Libre en ${normalizedIncoming.date}.`;
    }
  }

  if (incomingType === 'Extras' && hasShiftTimes(normalizedIncoming)) {
    const overlapping = comparable.find((shift) => {
      const existingType = getShiftType(shift);
      if (existingType !== 'Regular' && existingType !== 'Extras') {
        return false;
      }

      return hasShiftTimes(shift) && timeRangesOverlap(shift, normalizedIncoming);
    });

    if (overlapping) {
      return `El turno Extras se solapa con el turno ${getShiftType(overlapping)} de ${normalizedIncoming.date}. Corrigelo antes de añadirlo.`;
    }
  }

  return null;
}

function insertShift(current: Shift[], incoming: Shift): Shift[] {
  return [...current.filter((shift) => shift.id !== incoming.id), normalizeShift(incoming)];
}

interface ImportConflictState {
  existing: Shift;
  incoming: Shift;
  resolve: (action: 'replace' | 'skip' | 'abort') => void;
}

function describeShift(shift: Shift): string {
  const type = getShiftType(shift);
  const origin = getShiftOrigin(shift) === 'PDF' ? '(E)' : '(P)';
  if (!hasShiftTimes(shift)) {
    return `${origin} ${type} en ${shift.date}`;
  }
  return `${origin} ${type} ${shift.startTime}-${shift.endTime} en ${shift.date}`;
}
function App() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'system';
    }

    const savedTheme = window.localStorage.getItem('anclora_theme_mode');
    return savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
      ? savedTheme
      : 'system';
  });
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [importConflictState, setImportConflictState] = useState<ImportConflictState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateShifts = async () => {
      const nextShifts = await loadShifts();
      if (cancelled) {
        return;
      }

      setShifts(nextShifts);
    };

    void hydrateShifts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolvedTheme = themeMode === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : themeMode;
      root.dataset.theme = resolvedTheme;
    };

    applyTheme();
    window.localStorage.setItem('anclora_theme_mode', themeMode);
    mediaQuery.addEventListener('change', applyTheme);

    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
    };
  }, [themeMode]);

  const monthDays = useMemo(() => getMonthDaysISO(currentYear, currentMonth), [currentYear, currentMonth]);
  const daysInMonth = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);

  const currentMonthShifts = useMemo(() => {
    const firstDay = monthDays[0];
    const lastDay = monthDays[monthDays.length - 1];
    return shifts.filter(s => s.date >= firstDay && s.date <= lastDay);
  }, [shifts, monthDays]);
  const currentYearShifts = useMemo(
    () => shifts.filter((shift) => shift.date.startsWith(`${currentYear}-`)),
    [shifts, currentYear],
  );
  const daysInYear = useMemo(
    () => new Date(currentYear, 12, 0).getDate() === 366 ? 366 : 365,
    [currentYear],
  );

  const editingShift = useMemo(() =>
    shifts.find(s => s.id === editingShiftId) || null
  , [shifts, editingShiftId]);

  const handleNavigate = (delta: number) => {
    const d = new Date(currentYear, currentMonth + delta, 1);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
  };

  const handleSaveShift = async (shift: Shift) => {
    const conflict = findShiftConflict(shifts, shift);
    if (conflict) {
      window.alert(conflict);
      return;
    }

    const nextShifts = insertShift(shifts, shift);

    try {
      await syncShiftChanges(nextShifts, { upserts: [shift] });
      setShifts(nextShifts);
      setIsModalOpen(false);
      setEditingShiftId(null);
    } catch (error) {
      console.error('Failed to persist shift', error);
      window.alert('No se pudo guardar el turno en la base de datos. Inténtalo de nuevo.');
    }
  };

  const handleDeleteShift = async (id: string) => {
    const nextShifts = shifts.filter(s => s.id !== id);

    try {
      await syncShiftChanges(nextShifts, { deleteIds: [id] });
      setShifts(nextShifts);
      setIsModalOpen(false);
      setEditingShiftId(null);
    } catch (error) {
      console.error('Failed to delete shift', error);
      window.alert('No se pudo eliminar el turno de la base de datos. Inténtalo de nuevo.');
    }
  };

  const handleEditShift = (id: string) => {
    setEditingShiftId(id);
    setIsModalOpen(true);
  };

  const handleToggleTheme = () => {
    setThemeMode((current) => current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system');
  };
  const requestImportDecision = (existing: Shift, incoming: Shift) =>
    new Promise<'replace' | 'skip' | 'abort'>((resolve) => {
      setImportConflictState({ existing, incoming, resolve });
    });

  const handleConfirmImport = async (newShifts: Shift[], targetPeriod: CalendarImportContext): Promise<boolean> => {
    const snapshot = [...shifts];
    const normalizedIncoming = newShifts.map(normalizeShift);
    let working = [...snapshot];
    const pendingExistingPdfByDate = new Map<string, Shift[]>();
    const upserts: Shift[] = [];
    const deleteIds: string[] = [];

    for (const shift of normalizedIncoming) {
      const existingPdfShifts = pendingExistingPdfByDate.get(shift.date)
        ?? snapshot.filter((existing) => existing.date === shift.date && getShiftOrigin(existing) === 'PDF');

      pendingExistingPdfByDate.set(shift.date, existingPdfShifts);

      if (existingPdfShifts.length === 0) {
        working.push(shift);
        upserts.push(shift);
        continue;
      }

      const matchingExisting = existingPdfShifts.find((existing) => getShiftType(existing) === getShiftType(shift));
      const existingShift = matchingExisting ?? existingPdfShifts[0];
      const decision = await requestImportDecision(existingShift, shift);

      if (decision === 'abort') {
        setShifts(snapshot);
        return false;
      }

      if (decision === 'skip') {
        continue;
      }

      working = [...working.filter((existing) => existing.id !== existingShift.id), shift];
      upserts.push(shift);
      deleteIds.push(existingShift.id);
      pendingExistingPdfByDate.set(
        shift.date,
        existingPdfShifts.filter((existing) => existing.id !== existingShift.id),
      );
    }

    try {
      await syncShiftChanges(working, { upserts, deleteIds });
      setShifts(working);
      setCurrentYear(targetPeriod.year);
      setCurrentMonth(targetPeriod.month);
      setIsImportOpen(false);
      return true;
    } catch (error) {
      console.error('Failed to persist imported shifts', error);
      window.alert('No se pudieron guardar los turnos importados en la base de datos. Inténtalo de nuevo.');
      return false;
    }
  };

  return (
    <div className="container">
      <MonthHeader
        year={currentYear}
        month={currentMonth}
        onNavigate={handleNavigate}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
        onAddShift={() => {
          setEditingShiftId(null);
          setIsModalOpen(true);
        }}
        onImport={() => setIsImportOpen(true)}
      />

      <div className="dashboard-body">
        <StatsBar
          currentMonthShifts={currentMonthShifts}
          daysInMonth={daysInMonth}
          currentYearShifts={currentYearShifts}
          daysInYear={daysInYear}
        />

        <section className="calendar-stage">
          <MonthGrid
            year={currentYear}
            month={currentMonth}
            shifts={currentMonthShifts}
            onEditShift={handleEditShift}
          />
        </section>
      </div>

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
        initialContext={{ month: currentMonth, year: currentYear }}
      />

      {importConflictState && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800 }}>Conflicto en importación PDF</h3>
            <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ya existe un turno de empresa en este día. Elige qué hacer con el turno importado.
            </p>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px', background: 'var(--panel-muted-bg)' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginBottom: '4px' }}>Turno existente</div>
                <div style={{ fontWeight: 700 }}>{describeShift(importConflictState.existing)}</div>
              </div>
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px', background: 'var(--panel-muted-bg)' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginBottom: '4px' }}>Turno del PDF</div>
                <div style={{ fontWeight: 700 }}>{describeShift(importConflictState.incoming)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className="btn-outline"
                onClick={() => {
                  importConflictState.resolve('skip');
                  setImportConflictState(null);
                }}
                style={{ padding: '10px 14px', fontWeight: 700 }}
              >
                Omitir turno
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  importConflictState.resolve('abort');
                  setImportConflictState(null);
                }}
                style={{ padding: '10px 14px', fontWeight: 700, borderColor: 'var(--danger)', color: 'var(--danger)' }}
              >
                Abortar proceso
              </button>
              <button
                className="btn-gold"
                onClick={() => {
                  importConflictState.resolve('replace');
                  setImportConflictState(null);
                }}
                style={{ padding: '10px 14px', fontWeight: 800 }}
              >
                Actualizar con PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;






