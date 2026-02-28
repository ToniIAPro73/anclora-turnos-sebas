/**
 * Ollama Vision Parser: Uses a local LLM with vision capabilities 
 * to extract shift data from calendar images.
 * 
 * Supports Moondream (fast, lightweight) and Qwen2-VL as alternatives.
 * Requires: ollama running locally with a vision model.
 */

import { ParsedCalendarShift } from './calendar-image-parser';

const OLLAMA_API = 'http://localhost:11434/api/generate';

interface ExtractedShiftCandidate {
  day: number;
  start: string;
  end: string;
}

/** Convert AM/PM time to 24h format, or pass through HH:MM */
function to24h(t: string): string {
  if (!t) return '??:??';
  const s = t.trim().toUpperCase();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m) {
    let h = parseInt(m[1]);
    const min = m[2];
    if (m[3] === 'PM' && h !== 12) h += 12;
    if (m[3] === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  // Already HH:MM
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, min] = s.split(':');
    return `${h.padStart(2, '0')}:${min}`;
  }
  return t;
}

function normalize24hTime(t: string): string | null {
  const value = to24h(t).trim();
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Preferred Qwen vision models for this repo */
const PREFERRED_VISION_MODELS = [
  'qwen3-vl:8b',
  'qwen3-vl:4b',
  'qwen3-vl',
  'qwen3',
  'qwen2-vl:7b',
  'qwen2-vl:2b',
];

function isPreferredQwenVisionModel(modelName: string, preferred: string): boolean {
  if (modelName === preferred) {
    return true;
  }

  const normalized = modelName.toLowerCase();
  const target = preferred.toLowerCase();

  if (normalized.startsWith(target)) {
    return true;
  }

  if (target === 'qwen3') {
    return normalized.startsWith('qwen3');
  }

  if (target.startsWith('qwen3-vl')) {
    return normalized.startsWith('qwen3-vl');
  }

  if (target.startsWith('qwen2-vl')) {
    return normalized.startsWith('qwen2-vl');
  }

  return false;
}

function hasSuspiciousPattern(shifts: ExtractedShiftCandidate[]): boolean {
  if (shifts.length < 10) {
    const uniquePairs = new Set(shifts.map((shift) => `${to24h(shift.start)}-${to24h(shift.end)}`));
    const sortedDays = [...shifts].map((shift) => shift.day).sort((a, b) => a - b);
    const onlyFirstWeek = sortedDays.length >= 5 && sortedDays[0] === 1 && sortedDays[sortedDays.length - 1] <= 7;
    const mostlyConsecutive = sortedDays.every((day, index) => index === 0 || day === sortedDays[index - 1] + 1);

    return onlyFirstWeek && mostlyConsecutive && uniquePairs.size <= 2;
  }

  const uniquePairs = new Set(shifts.map((shift) => `${to24h(shift.start)}-${to24h(shift.end)}`));
  const sortedDays = [...shifts].map((shift) => shift.day).sort((a, b) => a - b);
  let consecutiveRuns = 1;

  for (let index = 1; index < sortedDays.length; index += 1) {
    if (sortedDays[index] === sortedDays[index - 1] + 1) {
      consecutiveRuns += 1;
    }
  }

  const almostAllConsecutive = consecutiveRuns >= shifts.length - 2;
  const veryLowDiversity = uniquePairs.size <= 2;

  return shifts.length >= 20 && almostAllConsecutive && veryLowDiversity;
}

function parseMonthFromResponse(rawResponse: string, currentYear: number): { year: number; monthNum: number } {
  const explicitMonth = rawResponse.match(/"month"\s*:\s*"(\d{4})-(\d{2})"/i);
  if (explicitMonth) {
    return {
      year: Number.parseInt(explicitMonth[1], 10),
      monthNum: Number.parseInt(explicitMonth[2], 10),
    };
  }

  let year = currentYear;
  let monthNum = new Date().getMonth() + 1;
  const lowerResponse = rawResponse.toLowerCase();

  const monthNames: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };

  for (const [name, num] of Object.entries(monthNames)) {
    if (lowerResponse.includes(name)) {
      monthNum = num;
      break;
    }
  }

  return { year, monthNum };
}

/**
 * Convert a File to base64 string for Ollama API
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Check if Ollama is available and find the best vision model
 */
export async function checkOllamaAvailable(): Promise<{ available: boolean; model: string | null }> {
  try {
    const resp = await fetch('http://localhost:11434/api/tags');
    if (!resp.ok) return { available: false, model: null };
    
    const data = await resp.json();
    const models: string[] = (data.models || []).map((m: any) => m.name);
    
    // Find best available preferred vision model
    for (const vm of PREFERRED_VISION_MODELS) {
      if (models.some((model) => isPreferredQwenVisionModel(model, vm))) {
        const matched = models.find((model) => isPreferredQwenVisionModel(model, vm));
        return { available: true, model: matched || vm };
      }
    }
    
    console.warn('[Ollama] No se encontro un modelo Qwen de vision compatible. Vision local desactivada.');
    return { available: true, model: null };
  } catch {
    return { available: false, model: null };
  }
}

/**
 * Send image to Ollama vision model and extract shifts as structured JSON
 */
export async function parseCalendarWithOllama(
  file: File,
  model: string
): Promise<ParsedCalendarShift[]> {
  const base64Image = await fileToBase64(file);
  const currentYear = new Date().getFullYear();

  const isMoondream = model.includes('moondream');
  
  const prompt = isMoondream
    ? `Read this monthly work calendar for year ${currentYear}.
Return only days from the main month shown in the header.
Ignore previous/next month faded days, ignore "Libre" and "TD".
For each worked day output exactly: Day [number]: [start time] - [end time].
Example: Day 1: 08:00 - 16:00`
    : `Analyze this monthly work calendar for year ${currentYear}.
Rules:
- Return only days belonging to the main month in the header.
- Ignore faded days from previous/next month.
- Ignore cells marked "Libre" or "TD".
- The start time is shown above the end time inside each day cell.
- If a day has no valid pair of times, omit it.
Reply only in JSON using this schema:
{"month":"${currentYear}-MM","shifts":[{"day":1,"start":"HH:MM","end":"HH:MM"}]}`;

  console.log(`[Ollama] Sending image to ${model}...`);
  const startTime = Date.now();

  const response = await fetch(OLLAMA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      images: [base64Image],
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 2048,
      }
    })
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const rawResponse = result.response || '';
  console.log(`[Ollama] Response in ${elapsed}s:`, rawResponse);

  // Pre-sanitize: remove brackets and single quotes that might confuse simple regex
  const cleanResponse = rawResponse.replace(/[\[\]']/g, ' ');

  // --- ULTRA-RESILIENT extraction ---
  const shiftArray: ExtractedShiftCandidate[] = [];
  
  // Pattern 1: Day 1: 08:00 - 16:00
  const p1 = /(?:Day|Día|D)\s*(\d+)[:\- ]+\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*(?:[-–to]|y|hasta|and)\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/gi;
  // Pattern 2: 05/03, 08:00, 16:00 or 05-03 : 08:00 ...
  const p2 = /(\d{1,2})[\/\.\-](\d{1,2})[\s,:\- ]+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[\s,:\-–to y hasta and]+\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/gi;
  // Pattern 3: JSON "day": 1, "start": "09:00", "end": "17:00"
  const p3 = /"day"\s*:\s*(\d+)\s*,\s*"start"\s*:\s*"([^"]+)"\s*,\s*"end"\s*:\s*"([^"]+)"/gi;
  // Pattern 4: Generic sequence: Day [Space] Time [Space] Time
  const p4 = /(?:^|[\s,])(\d{1,2})\s+[\s,:]\s*(\d{1,2}:\d{2})\s*[\s,:-]\s*(\d{1,2}:\d{2})/g;

  let match;
  
  // Run on cleanResponse
  while ((match = p1.exec(cleanResponse)) !== null) {
    shiftArray.push({ day: parseInt(match[1]), start: match[2], end: match[3] });
  }
  while ((match = p2.exec(cleanResponse)) !== null) {
    const n1 = parseInt(match[1]);
    const n2 = parseInt(match[2]);
    const day = (n1 > 12) ? n1 : (n2 > 12 ? n2 : n1); 
    shiftArray.push({ day, start: match[3], end: match[4] });
  }
  while ((match = p3.exec(cleanResponse)) !== null) {
    shiftArray.push({ day: parseInt(match[1]), start: match[2], end: match[3] });
  }
  while ((match = p4.exec(cleanResponse)) !== null) {
    shiftArray.push({ day: parseInt(match[1]), start: match[2], end: match[3] });
  }

  if (shiftArray.length === 0) {
    console.error('[Ollama] No shifts found in response');
    throw new Error(`No se encontraron turnos en la respuesta (${elapsed}s). Revisa la consola.`);
  }

  if (hasSuspiciousPattern(shiftArray)) {
    console.warn('[Ollama] Suspiciously repetitive response discarded:', shiftArray);
    throw new Error(`La respuesta del modelo parece inventada o demasiado uniforme (${elapsed}s).`);
  }

  const { year, monthNum } = parseMonthFromResponse(rawResponse, currentYear);

  // Deduplicate by day (keep first occurrence)
  const seenDays = new Set<number>();
  const uniqueShifts = shiftArray.filter(s => {
    if (seenDays.has(s.day)) return false;
    seenDays.add(s.day);
    return true;
  });

  const shifts: ParsedCalendarShift[] = uniqueShifts
    .map((shift) => {
      const startTime = normalize24hTime(shift.start);
      const endTime = normalize24hTime(shift.end);
      if (!startTime || !endTime) {
        return null;
      }

      return {
        date: `${year}-${String(monthNum).padStart(2, '0')}-${String(shift.day).padStart(2, '0')}`,
        startTime,
        endTime,
        isValid: true,
        confidence: 0.9,
        rawText: `${shift.start} - ${shift.end} (${model})`,
      };
    })
    .filter((shift): shift is ParsedCalendarShift => shift !== null);

  if (shifts.length === 0) {
    throw new Error(`La respuesta del modelo no contiene horas validas (${elapsed}s).`);
  }

  shifts.sort((a, b) => a.date.localeCompare(b.date));
  console.log(`[Ollama] Parsed ${shifts.length} shifts in ${elapsed}s`);
  return shifts;
}
