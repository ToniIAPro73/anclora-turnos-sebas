import { Shift } from '../types/shift';

const STORAGE_KEY = 'anclora_shifts_v1';

export const saveShifts = (shifts: Shift[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
};

export const loadShifts = (): Shift[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse shifts from storage', e);
    return [];
  }
};
