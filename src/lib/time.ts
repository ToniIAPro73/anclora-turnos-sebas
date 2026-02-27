/**
 * Pure functions for time manipulation and calculations.
 */

/**
 * Converts HH:mm string to minutes since start of day.
 * Example: "08:30" -> 510
 */
export const parseHHMM = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

/**
 * Compares two HH:mm strings.
 * Returns -1 if t1 < t2, 1 if t1 > t2, 0 if equal.
 */
export const compareTimes = (t1: string, t2: string): number => {
  const m1 = parseHHMM(t1);
  const m2 = parseHHMM(t2);
  if (m1 < m2) return -1;
  if (m1 > m2) return 1;
  return 0;
};

/**
 * Calculates duration in minutes between two times, accounting for overnight.
 * Example: "22:00" to "06:00" -> 480 minutes
 */
export const durationMinutes = (start: string, end: string): number => {
  const s = parseHHMM(start);
  let e = parseHHMM(end);
  
  if (e <= s) {
    e += 24 * 60; // Add 24 hours
  }
  
  return e - s;
};

/**
 * Checks if a shift is overnight.
 */
export const isOvernight = (start: string, end: string): boolean => {
  return parseHHMM(end) <= parseHHMM(start);
};
