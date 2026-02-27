/**
 * Pure functions for week and date manipulation (ISO YYYY-MM-DD strings).
 */

/**
 * Gets the date object for the Monday of the week containing the given date.
 */
export const getWeekStartMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * Formats a Date object to ISO YYYY-MM-DD.
 */
export const toISODate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Parses ISO YYYY-MM-DD string to Date object (local time).
 */
export const fromISODate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Gets all 7 days of a week starting from a Monday ISO date.
 */
export const getWeekDaysISO = (mondayISO: string): string[] => {
  const start = fromISODate(mondayISO);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toISODate(d);
  });
};

/**
 * Adds or subtracts weeks to an ISO date.
 */
export const addWeeks = (isoDate: string, weeks: number): string => {
  const d = fromISODate(isoDate);
  d.setDate(d.getDate() + (weeks * 7));
  return toISODate(d);
};

/**
 * Checks if two ISO date strings are equal.
 */
export const isSameISODate = (d1: string, d2: string): boolean => d1 === d2;
