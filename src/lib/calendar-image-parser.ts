import { createWorker } from 'tesseract.js';

export interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedCalendarShift {
  date: string;
  startTime: string;
  endTime: string;
  isValid: boolean;
  confidence: number;
  rawText: string;
}

const MONTHS_ES: Record<string, number> = {
  'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
  'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
  'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
};

/**
/**
 * Create a processed canvas from an image file.
 */
function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Apply contrast enhancement (good for dark text on light bg) */
function applyContrast(canvas: HTMLCanvasElement): Blob | Promise<Blob> {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c];
      val = ((val - 128) * 1.8) + 128;
      data[i + c] = Math.max(0, Math.min(255, val));
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return new Promise(r => canvas.toBlob(b => r(b!), 'image/png'));
}

/** Apply color inversion (good for white text on colored bg like red boxes) */
function applyInvert(canvas: HTMLCanvasElement): Promise<Blob> {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(imageData, 0, 0);
  return new Promise(r => canvas.toBlob(b => r(b!), 'image/png'));
}

/**
 * Run OCR with TWO passes: normal contrast + inverted colors.
 * Merges text from both to capture dark AND light text.
 */
export async function extractTextBlocksWithPositions(imageFile: File): Promise<{ blocks: TextBlock[]; rawText: string }> {
  const worker = await createWorker('spa+eng');

  // Pass 1: Contrast enhancement
  const canvas1 = await loadImageToCanvas(imageFile);
  const blob1 = await applyContrast(canvas1);
  const result1 = await worker.recognize(blob1);
  const text1 = (result1.data as any).text || '';
  console.log('[OCR Pass 1 - Contrast] Text:\n', text1);

  // Pass 2: Inverted colors
  const canvas2 = await loadImageToCanvas(imageFile);
  const blob2 = await applyInvert(canvas2);
  const result2 = await worker.recognize(blob2);
  const text2 = (result2.data as any).text || '';
  console.log('[OCR Pass 2 - Inverted] Text:\n', text2);

  await worker.terminate();

  // Merge: use the longer text as primary, supplement with the other
  const rawText = text1.length >= text2.length ? text1 : text2;
  const supplementary = text1.length >= text2.length ? text2 : text1;

  console.log(`[OCR] Primary: ${rawText.length} chars, Supplementary: ${supplementary.length} chars`);

  return { blocks: [], rawText, supplementaryText: supplementary } as any;
}

/**
 * Detect month and year from raw text
 */
export function detectMonthYear(rawText: string, blocks: TextBlock[]): { month: number; year: number } {
  const now = new Date();
  let detectedMonth = now.getMonth();
  let detectedYear = now.getFullYear();

  const combined = (rawText + ' ' + blocks.map(b => b.text).join(' ')).toLowerCase();
  for (const [name, index] of Object.entries(MONTHS_ES)) {
    if (combined.includes(name)) { detectedMonth = index; break; }
  }
  const yearMatch = combined.match(/\b(202[4-9]|203[0-9])\b/);
  if (yearMatch) detectedYear = parseInt(yearMatch[1]);

  console.log(`[OCR] Detected month=${detectedMonth}, year=${detectedYear}`);
  return { month: detectedMonth, year: detectedYear };
}

/** Normalize OCR time: handles HH:MM, HHMM, HH.MM, etc */
function normalizeTime(raw: string): string | null {
  let t = raw.trim()
    .replace(/[oO]/g, '0').replace(/[lI]/g, '1')
    .replace(/\s+/g, '').replace(/[.,;]/g, ':');

  // Try HH:MM first
  let match = t.match(/^(\d{1,2}):(\d{2})$/);
  // Fallback: 4-digit no separator (e.g. "1300" → 13:00)
  if (!match) match = t.match(/^(\d{2})(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1]), m = parseInt(match[2]);
  if (h > 23 || m > 59) return null;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * ROW-GROUP PARSER: Understands the calendar's row structure.
 * 
 * OCR output pattern for each week row:
 *   Line A: "2 3 4 5 6 7 8"          ← day numbers
 *   Line B: "17:00 | 17:00 | ... "    ← start times (pipe-separated)
 *   Line C: "01:00 01:00 TD 13:00..." ← end times (space-separated)
 * 
 * Strategy: detect day-number rows, then read subsequent lines as columns.
 */
export function parseShiftsFromText(rawText: string, month: number, year: number): ParsedCalendarShift[] {
  const results: ParsedCalendarShift[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // Step 1: Find day-number rows (lines where most tokens are numbers 1-31)
  const dayRowIndices: number[] = [];
  const dayRowDays: number[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // KEY: Day rows never contain ':' — time rows always do
    if (line.includes(':')) continue;

    const tokens = line.split(/\s+/);
    const nums = tokens.map(t => parseInt(t)).filter(n => !isNaN(n) && n >= 1 && n <= 31);
    // A day row has at least 2 valid day numbers and most tokens are numbers
    if (nums.length >= 2 && nums.length >= tokens.length * 0.5) {
      dayRowIndices.push(i);
      dayRowDays.push(nums);
    }
  }

  // Handle single-day case (like "1" alone on a line)
  for (let i = 0; i < lines.length; i++) {
    if (dayRowIndices.includes(i)) continue;
    const t = lines[i].trim();
    if (t.includes(':')) continue; // skip time lines
    if (/^([1-9]|[12]\d|3[01])$/.test(t)) {
      const num = parseInt(t);
      if (!dayRowDays.flat().includes(num)) {
        dayRowIndices.push(i);
        dayRowDays.push([num]);
      }
    }
  }

  // Sort by line index
  const sorted = dayRowIndices.map((idx, i) => ({ lineIdx: idx, days: dayRowDays[i] }))
    .sort((a, b) => a.lineIdx - b.lineIdx);

  console.log('[Parser] Day rows:', sorted.map(s => `line ${s.lineIdx}: [${s.days}]`));

  // Step 2: For each day row, collect subsequent lines until the next day row
  for (let ri = 0; ri < sorted.length; ri++) {
    const { lineIdx, days } = sorted[ri];
    const nextLineIdx = sorted[ri + 1]?.lineIdx ?? lines.length;

    // Collect data lines below this day row
    const dataLines = lines.slice(lineIdx + 1, nextLineIdx);
    console.log(`[Parser] Days [${days}] → data lines:`, dataLines);

    if (days.length === 1) {
      // Single day: just extract all times
      const allTimes: string[] = [];
      for (const dl of dataLines) {
        const tokens = dl.replace(/\|/g, ' ').split(/\s+/);
        for (const tok of tokens) {
          const t = normalizeTime(tok);
          if (t) allTimes.push(t);
        }
      }
      if (allTimes.length >= 2) {
        const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(days[0]).padStart(2, '0')}`;
        results.push({
          date: isoDate, startTime: allTimes[0], endTime: allTimes[1],
          isValid: true, confidence: 0.8, rawText: `${allTimes[0]} - ${allTimes[1]}`
        });
      }
      continue;
    }

    // Multi-day row: parse BOTH data lines into columns
    // END times (line 2) are MORE RELIABLE than start times (line 1)
    // because start times in colored boxes often get missed by OCR.
    
    const startCols: string[] = [];
    const endCols: string[] = [];

    if (dataLines.length >= 1) {
      const cols = splitIntoColumns(dataLines[0], days.length);
      startCols.push(...cols);
    }
    if (dataLines.length >= 2) {
      const cols = splitIntoColumns(dataLines[1], days.length);
      endCols.push(...cols);
    }

    // If we only have 1 data line, treat it as end times (more likely to be complete)
    const useEnd = endCols.length > 0 ? endCols : startCols;
    let useStart = endCols.length > 0 ? startCols : [];

    // RIGHT-ALIGN: if start has fewer columns than end, the OCR likely
    // missed left-side colored text. Pad start array at the beginning.
    if (useStart.length > 0 && useStart.length < useEnd.length) {
      const padding = new Array(useEnd.length - useStart.length).fill('');
      useStart = [...padding, ...useStart];
      console.log(`[Parser] Right-aligned start times: ${useStart.length} cols`);
    }

    // Create shifts: iterate over days and assign from columns
    for (let d = 0; d < days.length; d++) {
      const day = days[d];
      if (day < 1 || day > 31) continue;

      const endRaw = useEnd[d];
      const startRaw = useStart[d];
      
      const endTime = endRaw ? normalizeTime(endRaw) : null;
      const startTime = startRaw ? normalizeTime(startRaw) : null;

      // Skip "Libre" / "TD" days (no shift)
      if (endRaw && /libre|td/i.test(endRaw)) continue;
      if (startRaw && /libre|td/i.test(startRaw)) continue;

      // We need at least an end time to create a shift entry
      if (endTime || startTime) {
        const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        results.push({
          date: isoDate,
          startTime: startTime || '??:??',
          endTime: endTime || '??:??',
          isValid: !!(startTime && endTime),
          confidence: startTime && endTime ? 0.85 : 0.5,
          rawText: `${startTime || '??'} - ${endTime || '??'}`
        });
      }
    }
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  console.log(`[Parser] Total shifts: ${results.length}`);
  return results;
}

/**
 * Split a line into N columns, using pipes as primary separator,
 * then spaces as fallback.
 */
function splitIntoColumns(line: string, expectedCols: number): string[] {
  // If line contains pipes, use them
  if (line.includes('|')) {
    const parts = line.split('|').map(p => p.trim());
    // If we got roughly the right number of columns, great
    if (parts.length >= expectedCols - 1) {
      return parts;
    }
  }

  // Fallback: split by whitespace
  const tokens = line.split(/\s+/).filter(Boolean);
  return tokens;
}

/**
 * Main entry: parses BOTH OCR passes and merges unique shifts.
 */
export function processCalendarData(
  _blocks: TextBlock[],
  rawText: string,
  month: number,
  year: number,
  supplementaryText?: string
): ParsedCalendarShift[] {
  // Parse primary text
  const primary = parseShiftsFromText(rawText, month, year);
  console.log(`[Merge] Primary pass: ${primary.length} shifts`);

  if (!supplementaryText) return primary;

  // Parse supplementary text
  const secondary = parseShiftsFromText(supplementaryText, month, year);
  console.log(`[Merge] Secondary pass: ${secondary.length} shifts`);

  // Merge: keep all primary, add secondary if date not already covered
  const coveredDates = new Set(primary.map(s => s.date));
  const merged = [...primary];

  for (const s of secondary) {
    if (!coveredDates.has(s.date)) {
      merged.push(s);
      coveredDates.add(s.date);
    }
  }

  merged.sort((a, b) => a.date.localeCompare(b.date));
  console.log(`[Merge] Final merged: ${merged.length} shifts`);
  return merged;
}
