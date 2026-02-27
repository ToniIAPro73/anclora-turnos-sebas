import { Shift, ShiftCategory, ShiftWithDerived } from '../types/shift';

/**
 * Logic for shift duration, categorization and ordering.
 */

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const calcDuration = (start: string, end: string): number => {
  const startMins = timeToMinutes(start);
  let endMins = timeToMinutes(end);

  if (endMins <= startMins) {
    // Overnight shift
    endMins += 24 * 60;
  }

  return (endMins - startMins) / 60;
};

export const getCategory = (startTime: string): ShiftCategory => {
  const hours = parseInt(startTime.split(':')[0], 10);

  if (hours >= 8 && hours < 14) return 'Mañana';
  if (hours >= 14 && hours < 22) return 'Tarde';
  return 'Noche';
};

export const enrichShift = (shift: Shift): ShiftWithDerived => {
  return {
    ...shift,
    category: getCategory(shift.startTime),
    duration: calcDuration(shift.startTime, shift.endTime),
  };
};

export const sortShifts = (shifts: Shift[]): Shift[] => {
  return [...shifts].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
};

export const getNextShift = (shifts: Shift[], now: Date = new Date()): Shift | null => {
  const sorted = sortShifts(shifts);
  const nowISO = now.toISOString().split('T')[0];
  const nowTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return sorted.find(s => {
    if (s.date > nowISO) return true;
    if (s.date === nowISO && s.startTime > nowTime) return true;
    return false;
  }) || null;
};

export const calculateWeeklyStats = (weekShifts: Shift[]): { weeklyHours: number; freeDays: number } => {
  const enriched = weekShifts.map(enrichShift);
  const weeklyHours = enriched.reduce((acc, s) => acc + s.duration, 0);
  
  const busyDays = new Set(weekShifts.map(s => s.date)).size;
  const freeDays = 7 - busyDays;

  return { weeklyHours, freeDays };
};
