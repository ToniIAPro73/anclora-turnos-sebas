import { CalendarImportContext, ParsedCalendarShift } from './calendar-image-parser';

const TURNO_APP_PUBLIC_EXTRACT_URL =
  'https://3000-i6m0y9d08zi38wmzuibz5-f8d4e65e.us1.manus.computer/api/public/shifts/extract';
const ORIGIN_MODEL = 'gemini-2.5-flash';

interface ShiftCandidate {
  day: number;
  month?: number | null;
  year?: number | null;
  shiftType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  color?: string | null;
  notes?: string | null;
}

interface VisionBackendHealth {
  available: boolean;
  model: string | null;
}

function hasMeaningfulShiftData(candidate: ShiftCandidate): boolean {
  const hasType = Boolean(candidate.shiftType?.trim());
  const hasNotes = Boolean(candidate.notes?.trim());
  const hasStart = Boolean(normalizeTime(candidate.startTime));
  const hasEnd = Boolean(normalizeTime(candidate.endTime));
  return hasType || hasNotes || hasStart || hasEnd;
}

function normalizeTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const source = value
    .trim()
    .toUpperCase()
    .replace(/[.,;]/g, ':')
    .replace(/\s+/g, '')
    .replace(/[O]/g, '0')
    .replace(/[I|L]/g, '1');

  const twelveHour = source.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (twelveHour) {
    let hour = Number.parseInt(twelveHour[1], 10);
    const minute = Number.parseInt(twelveHour[2], 10);
    if (twelveHour[3] === 'PM' && hour !== 12) {
      hour += 12;
    }
    if (twelveHour[3] === 'AM' && hour === 12) {
      hour = 0;
    }
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const hhmm = source.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const hour = Number.parseInt(hhmm[1], 10);
    const minute = Number.parseInt(hhmm[2], 10);
    if (hour <= 23 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  const compact = source.match(/^(\d{2})(\d{2})$/);
  if (compact) {
    const hour = Number.parseInt(compact[1], 10);
    const minute = Number.parseInt(compact[2], 10);
    if (hour <= 23 && minute <= 59) {
      return `${compact[1]}:${compact[2]}`;
    }
  }

  return null;
}

function normalizeShiftType(value: string | null | undefined, startTime: string | null, endTime: string | null): string {
  const normalized = (value ?? '').trim().toUpperCase();
  if (normalized === 'JT') {
    return 'JT';
  }
  if (normalized === 'LIBRE') {
    return 'Libre';
  }
  if (normalized === 'REGULAR') {
    return 'Regular';
  }

  return startTime || endTime ? 'Regular' : 'Libre';
}

function normalizeColor(value: string | null | undefined, shiftType: string): string | null {
  if (value) {
    return value;
  }

  const lower = shiftType.toLowerCase();
  if (lower === 'libre') {
    return 'red';
  }
  if (lower === 'td' || lower === 'jt') {
    return 'gray';
  }
  return 'blue';
}

async function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return {
    mimeType: file.type || 'image/png',
    data,
  };
}

function mapCandidate(candidate: ShiftCandidate, context: CalendarImportContext): ParsedCalendarShift | null {
  if (!hasMeaningfulShiftData(candidate)) {
    return null;
  }

  const day = Number(candidate.day);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return null;
  }

  const month = candidate.month ?? (context.month + 1);
  const year = candidate.year ?? context.year;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  const startTime = normalizeTime(candidate.startTime) ?? '??:??';
  const endTime = normalizeTime(candidate.endTime) ?? '??:??';
  const shiftType = normalizeShiftType(candidate.shiftType, candidate.startTime ?? null, candidate.endTime ?? null);
  const isValid = startTime !== '??:??' && endTime !== '??:??';

  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    startTime,
    endTime,
    isValid,
    confidence: isValid ? 0.92 : 0.62,
    rawText: JSON.stringify(candidate),
    shiftType,
    notes: null,
    color: normalizeColor(candidate.color, shiftType),
  };
}

function dedupeParsedShifts(shifts: ParsedCalendarShift[]): ParsedCalendarShift[] {
  const byDate = new Map<string, ParsedCalendarShift>();

  for (const shift of shifts) {
    const existing = byDate.get(shift.date);
    if (!existing) {
      byDate.set(shift.date, shift);
      continue;
    }

    const existingScore = (existing.isValid ? 10 : 0) + Math.round(existing.confidence * 10);
    const nextScore = (shift.isValid ? 10 : 0) + Math.round(shift.confidence * 10);
    byDate.set(shift.date, nextScore >= existingScore ? shift : existing);
  }

  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

async function postJson<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Proxy error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function checkGeminiAvailable(): Promise<VisionBackendHealth> {
  return { available: true, model: ORIGIN_MODEL };
}

export async function parseCalendarWithGemini(
  file: File,
  context: CalendarImportContext,
): Promise<ParsedCalendarShift[]> {
  const inlineData = await fileToBase64(file);
  const result = await postJson<{ shifts: ShiftCandidate[] }>(TURNO_APP_PUBLIC_EXTRACT_URL, {
    imageBase64: inlineData.data,
    month: context.month + 1,
    year: context.year,
  });

  const shifts = result.shifts
    .map((candidate) => mapCandidate(candidate, context))
    .filter((candidate): candidate is ParsedCalendarShift => candidate !== null);

  if (shifts.length === 0) {
    throw new Error('El endpoint publico no devolvio turnos utilizables para la imagen.');
  }

  return dedupeParsedShifts(shifts);
}

export async function parseCalendarTextWithGemini(
  ocrText: string,
  context: CalendarImportContext,
): Promise<ParsedCalendarShift[]> {
  const result = await postJson<{ shifts: ShiftCandidate[] }>(TURNO_APP_PUBLIC_EXTRACT_URL, {
    ocrText,
    month: context.month + 1,
    year: context.year,
  });

  const shifts = result.shifts
    .map((candidate) => mapCandidate(candidate, context))
    .filter((candidate): candidate is ParsedCalendarShift => candidate !== null);

  if (shifts.length === 0) {
    throw new Error('El endpoint publico no devolvio turnos utilizables para el texto OCR.');
  }

  return dedupeParsedShifts(shifts);
}
