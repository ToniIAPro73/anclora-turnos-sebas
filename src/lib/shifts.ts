import { Shift, ShiftCategory, ShiftWithDerived, WeeklyStats } from './types';
import { durationMinutes, parseHHMM } from './time';

const isEmptyTime = (value: string): boolean => value.trim() === '';

export const normalizeShiftTypeLabel = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'jt') return 'JT';
  if (normalized === 'libre') return 'Libre';
  if (normalized === 'extras') return 'Extras';
  if (normalized === 'regular') return 'Regular';

  const importedMatch = normalized.match(/^importado\s*\(([^)]+)\)$/i);
  if (importedMatch) {
    return normalizeShiftTypeLabel(importedMatch[1]);
  }

  return 'Regular';
};

export const getShiftType = (shift: Shift): string => {
  const normalizedFromLocation = normalizeShiftTypeLabel(shift.location);
  if (normalizedFromLocation) {
    return normalizedFromLocation;
  }

  if (isEmptyTime(shift.startTime) && isEmptyTime(shift.endTime)) {
    return 'Libre';
  }

  return 'Regular';
};

export const hasShiftTimes = (shift: Shift): boolean =>
  !isEmptyTime(shift.startTime) && !isEmptyTime(shift.endTime);

export const isFreeShift = (shift: Shift): boolean => getShiftType(shift) === 'Libre';

/**
 * Pure functions for shift business logic.
 */

/**
 * Determines category based on SPEC:
 * Mañana: [08:00 - 14:00)
 * Tarde: [14:00 - 22:00)
 * Noche: Rest
 */
export const computeShiftCategory = (startTime: string): ShiftCategory => {
  if (isEmptyTime(startTime)) return 'Mañana';

  const mins = parseHHMM(startTime);
  const eightAM = 8 * 60;
  const twoPM = 14 * 60;
  const tenPM = 22 * 60;

  if (mins >= eightAM && mins < twoPM) return 'Mañana';
  if (mins >= twoPM && mins < tenPM) return 'Tarde';
  return 'Noche';
};

/**
 * Enriches a shift with derived metadata.
 */
export const enrichShift = (shift: Shift): ShiftWithDerived => ({
  ...shift,
  category: computeShiftCategory(shift.startTime),
  duration: isFreeShift(shift) ? 0 : durationMinutes(shift.startTime, shift.endTime) / 60,
});

/**
 * Filters shifts within a specific week.
 */
export const getShiftsInWeek = (shifts: Shift[], weekDays: string[]): Shift[] => {
  const daySet = new Set(weekDays);
  return shifts.filter(s => daySet.has(s.date));
};

/**
 * Finds the chronologically next shift relative to "now".
 */
export const getNextShift = (shifts: Shift[], now: Date = new Date()): Shift | null => {
  const nowISO = now.toISOString().split('T')[0];
  const nowTime = now.toTimeString().slice(0, 5);

  const upcoming = shifts.filter(s =>
    hasShiftTimes(s) && (
    s.date > nowISO || (s.date === nowISO && s.startTime > nowTime)
  ));

  if (upcoming.length === 0) return null;

  return upcoming.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  })[0];
};

/**
 * Aggregates statistics for a set of shifts over a given number of days.
 */
export const aggregateWeeklyStats = (shifts: Shift[], totalDays: number = 7): WeeklyStats => {
  const enriched = shifts.map(enrichShift);
  const weeklyHours = enriched.reduce((acc, s) => acc + s.duration, 0);

  const explicitFreeDays = new Set(shifts.filter(isFreeShift).map(s => s.date)).size;
  const busyDays = new Set(shifts.filter(s => !isFreeShift(s)).map(s => s.date)).size;
  const freeDays = explicitFreeDays + Math.max(0, totalDays - explicitFreeDays - busyDays);
  const hoursByType = {
    Regular: 0,
    JT: 0,
    Extras: 0,
  };

  for (const shift of shifts) {
    const type = getShiftType(shift);
    if (type === 'Regular' || type === 'JT' || type === 'Extras') {
      hoursByType[type] += enrichShift(shift).duration;
    }
  }

  return { weeklyHours, freeDays, hoursByType };
};
