export interface CalendarImportContext {
  month: number;
  year: number;
}

export type PdfDocumentType = 'TYPE_A' | 'TYPE_B' | 'UNKNOWN';

export interface ParsedCalendarShift {
  date: string;
  startTime: string;
  endTime: string;
  origin?: 'IMG' | 'PDF';
  isValid: boolean;
  confidence: number;
  rawText: string;
  shiftType?: string | null;
  notes?: string | null;
  color?: string | null;
}
