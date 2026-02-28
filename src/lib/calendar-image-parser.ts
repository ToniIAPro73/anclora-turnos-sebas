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
 * Preprocess image: upscale 2x + grayscale + threshold for clean OCR
 */
async function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const val = gray < 160 ? 0 : 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Run OCR with preprocessing
 */
export async function extractTextBlocksWithPositions(imageFile: File): Promise<{ blocks: TextBlock[]; rawText: string }> {
  const processed = await preprocessImage(imageFile);
  const worker = await createWorker('spa+eng');
  const result = await worker.recognize(processed);
  const data = result.data as any;

  console.log('[OCR] Full text:\n', data.text);

  const blocks: TextBlock[] = [];
  if (data.words && data.words.length > 0) {
    for (const word of data.words) {
      if (word.text && word.text.trim()) {
        blocks.push({
          text: word.text.trim(),
          x: word.bbox?.x0 ?? 0,
          y: word.bbox?.y0 ?? 0,
          width: (word.bbox?.x1 ?? 0) - (word.bbox?.x0 ?? 0),
          height: (word.bbox?.y1 ?? 0) - (word.bbox?.y0 ?? 0),
        });
      }
    }
  }

  await worker.terminate();
  return { blocks, rawText: data.text || '' };
}

/**
 * Detect month and year
 */
export function detectMonthYear(rawText: string, blocks: TextBlock[]): { month: number; year: number } {
  const now = new Date();
  let detectedMonth = now.getMonth();
  let detectedYear = now.getFullYear();

  const combined = (rawText + ' ' + blocks.map(b => b.text).join(' ')).toLowerCase();

  for (const [name, index] of Object.entries(MONTHS_ES)) {
    if (combined.includes(name)) {
      detectedMonth = index;
      break;
    }
  }

  const yearMatch = combined.match(/\b(202[4-9]|203[0-9])\b/);
  if (yearMatch) detectedYear = parseInt(yearMatch[1]);

  console.log(`[OCR] Detected month=${detectedMonth}, year=${detectedYear}`);
  return { month: detectedMonth, year: detectedYear };
}

/**
 * Normalize OCR time string: fix common misreads
 */
function normalizeTime(raw: string): string | null {
  let t = raw.trim()
    .replace(/[oO]/g, '0')
    .replace(/[lI]/g, '1')
    .replace(/\s+/g, '')
    .replace(/[.,;]/g, ':');

  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * COLUMN-BASED PARSING: Uses X-coordinates to assign times to the correct day.
 * 
 * Calendar grid layout:
 * Row of days:   2    3    4    5    6    7    8
 * Below each:  17:00 17:00 Libre ...  09:00 08:00 07:30
 *              01:00 01:00            13:00 12:00 13:30
 * 
 * Each day and its times share a similar X-coordinate (same column).
 */
export function parseShiftsFromBlocks(blocks: TextBlock[], month: number, year: number): ParsedCalendarShift[] {
  const results: ParsedCalendarShift[] = [];

  // Classify blocks
  const dayBlocks: (TextBlock & { day: number })[] = [];
  const timeBlocks: (TextBlock & { time: string })[] = [];

  for (const b of blocks) {
    const text = b.text.trim();

    // Skip non-shift labels
    if (/^(libre|td|jt|calendario|informes|turnos|más)$/i.test(text)) continue;

    // Check if it's a time
    const time = normalizeTime(text);
    if (time) {
      timeBlocks.push({ ...b, time });
      continue;
    }

    // Check if it's a day number (1-31)
    const numMatch = text.match(/^(\d{1,2})$/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num >= 1 && num <= 31) {
        dayBlocks.push({ ...b, day: num });
      }
    }
  }

  console.log(`[OCR Column] Day blocks: ${dayBlocks.map(d => `${d.day}@(${d.x},${d.y})`).join(', ')}`);
  console.log(`[OCR Column] Time blocks: ${timeBlocks.map(t => `${t.time}@(${t.x},${t.y})`).join(', ')}`);

  // For each time block, find the NEAREST day block that is:
  // 1. In the same column (close X-coordinate)
  // 2. Above or at the same Y (day numbers are above their times)
  const assignments: Map<number, string[]> = new Map();

  for (const tb of timeBlocks) {
    let bestDay: number | null = null;
    let bestDist = Infinity;

    for (const db of dayBlocks) {
      const dx = Math.abs(tb.x - db.x);
      const dy = tb.y - db.y; // positive means time is below day (correct)

      // Time must be below the day number, and in same column
      if (dy > 0 && dx < 100) {
        // Prefer closest column match, then closest vertical
        const dist = dx * 3 + dy; // Weight X more to prioritize column alignment
        if (dist < bestDist) {
          bestDist = dist;
          bestDay = db.day;
        }
      }
    }

    if (bestDay !== null) {
      if (!assignments.has(bestDay)) assignments.set(bestDay, []);
      assignments.get(bestDay)!.push(tb.time);
    }
  }

  console.log('[OCR Column] Assignments:', Object.fromEntries(assignments));

  // Convert assignments to shifts (pair times: 1st=start, 2nd=end)
  for (const [day, times] of assignments) {
    if (times.length >= 2) {
      const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      for (let i = 0; i < times.length - 1; i += 2) {
        results.push({
          date: isoDate,
          startTime: times[i],
          endTime: times[i + 1],
          isValid: true,
          confidence: 0.85,
          rawText: `${times[i]} - ${times[i + 1]}`
        });
      }
    }
  }

  // Sort by date
  results.sort((a, b) => a.date.localeCompare(b.date));

  return results;
}

/**
 * Main entry
 */
export function processCalendarData(
  blocks: TextBlock[],
  _rawText: string,
  month: number,
  year: number
): ParsedCalendarShift[] {
  const results = parseShiftsFromBlocks(blocks, month, year);
  console.log(`[OCR] Final: ${results.length} shifts detected`);
  return results;
}
