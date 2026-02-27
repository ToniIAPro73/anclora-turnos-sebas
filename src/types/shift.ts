export type ShiftCategory = 'Mañana' | 'Tarde' | 'Noche';

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
}

export interface ShiftWithDerived extends Shift {
  category: ShiftCategory;
  duration: number; // in hours
}

export interface WeeklyStats {
  nextShift: Shift | null;
  weeklyHours: number;
  freeDays: number;
}
