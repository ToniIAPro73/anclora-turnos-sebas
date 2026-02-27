import { Shift, ShiftCategory, ShiftWithDerived, WeeklyStats } from './types';
import { durationMinutes, parseHHMM } from './time';

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
  duration: durationMinutes(shift.startTime, shift.endTime) / 60,
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
    s.date > nowISO || (s.date === nowISO && s.startTime > nowTime)
  );

  if (upcoming.length === 0) return null;

  return upcoming.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  })[0];
};

/**
 * Aggregates statistics for a set of shifts.
 */
export const aggregateWeeklyStats = (weekShifts: Shift[]): WeeklyStats => {
  const enriched = weekShifts.map(enrichShift);
  const weeklyHours = enriched.reduce((acc, s) => acc + s.duration, 0);
  
  const busyDays = new Set(weekShifts.map(s => s.date)).size;
  const freeDays = 7 - busyDays;

  return { weeklyHours, freeDays };
};
