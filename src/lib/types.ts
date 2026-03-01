export type ShiftCategory = 'Mañana' | 'Tarde' | 'Noche';

export interface Shift {
  id: string;
  date: string; // ISO YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
}

export interface ShiftWithDerived extends Shift {
  category: ShiftCategory;
  duration: number; // in hours
}

export interface WeeklyStats {
  weeklyHours: number;
  freeDays: number;
  hoursByType: {
    Regular: number;
    JT: number;
    Extras: number;
  };
}
