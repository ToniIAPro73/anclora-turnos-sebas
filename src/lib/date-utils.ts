/**
 * Logic for handling weeks starting on Monday and general date formatting.
 */

export const getMonday = (date: Date): Date => {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const formatISO = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const parseISO = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const isSameDay = (date1: string, date2: string): boolean => {
  return date1 === date2;
};

export const getWeekRange = (mondayStr: string): string[] => {
  const monday = parseISO(mondayStr);
  return Array.from({ length: 7 }, (_, i) => formatISO(addDays(monday, i)));
};

export const formatDisplayDate = (dateStr: string): string => {
  const date = parseISO(dateStr);
  return new Intl.DateTimeFormat('es-ES', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  }).format(date);
};
