export type ShiftCategory = 'Mañana' | 'Tarde' | 'Noche';
export type ShiftOrigin = 'IMG' | 'PDF';

export interface Shift {
  id: string;
  date: string; // ISO YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  origin: ShiftOrigin;
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
  daysByType: {
    JT: number;
  };
}
