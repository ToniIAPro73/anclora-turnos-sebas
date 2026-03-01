import { Shift } from './types';

const STORAGE_KEY = 'anclora_shifts_v1';

const normalizeShiftDate = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    return trimmed;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const normalizeShift = (shift: Shift): Shift => ({
  ...shift,
  date: normalizeShiftDate(shift.date),
  startTime: shift.startTime.trim(),
  endTime: shift.endTime.trim(),
  location: shift.location.trim(),
});

export const saveShifts = (shifts: Shift[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts.map(normalizeShift)));
};

export const loadShifts = (): Shift[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return (JSON.parse(data) as Shift[]).map(normalizeShift);
  } catch (e) {
    console.error('Failed to parse shifts from storage', e);
    return [];
  }
};
