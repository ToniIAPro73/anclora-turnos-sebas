import { Shift } from './types';

const STORAGE_KEY = 'anclora_shifts_v1';
const SHIFTS_API_URL = '/api/shifts';
const REMOTE_STORAGE_ENABLED = !import.meta.env.DEV || import.meta.env.VITE_ENABLE_REMOTE_STORAGE === 'true';

const normalizeShiftDate = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    return trimmed;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const normalizeShift = (shift: Shift): Shift => ({
  ...shift,
  date: normalizeShiftDate(shift.date),
  startTime: shift.startTime.trim(),
  endTime: shift.endTime.trim(),
  location: shift.location.trim(),
  origin: shift.origin === 'PDF' ? 'PDF' : 'IMG',
});

const loadLocalShifts = (): Shift[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return (JSON.parse(data) as Shift[]).map(normalizeShift);
  } catch (e) {
    console.error('Failed to parse shifts from storage', e);
    return [];
  }
};

async function readApiShifts(): Promise<Shift[]> {
  const response = await fetch(SHIFTS_API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${SHIFTS_API_URL} failed with ${response.status}`);
  }

  const payload = (await response.json()) as { shifts?: Shift[] };
  if (!Array.isArray(payload.shifts)) {
    throw new Error('Invalid shifts payload from API');
  }

  return payload.shifts.map(normalizeShift);
}

async function writeApiShifts(shifts: Shift[]): Promise<void> {
  const response = await fetch(SHIFTS_API_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      shifts: shifts.map(normalizeShift),
    }),
  });

  if (!response.ok) {
    throw new Error(`PUT ${SHIFTS_API_URL} failed with ${response.status}`);
  }
}

export const saveShifts = async (shifts: Shift[]): Promise<void> => {
  const normalized = shifts.map(normalizeShift);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

  if (!REMOTE_STORAGE_ENABLED) {
    return;
  }

  try {
    await writeApiShifts(normalized);
  } catch (error) {
    console.error('Failed to sync shifts to API, keeping local cache', error);
  }
};

export const loadShifts = async (): Promise<Shift[]> => {
  const localShifts = loadLocalShifts();

  if (!REMOTE_STORAGE_ENABLED) {
    return localShifts;
  }

  try {
    const remoteShifts = await readApiShifts();
    if (remoteShifts.length === 0 && localShifts.length > 0) {
      return localShifts;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteShifts));
    return remoteShifts;
  } catch (error) {
    console.error('Failed to load shifts from API, using local cache', error);
    return localShifts;
  }
};
