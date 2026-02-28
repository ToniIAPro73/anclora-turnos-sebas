/**
 * Ollama Vision Parser: Uses a local LLM with vision capabilities 
 * to extract shift data from calendar images.
 * 
 * Much more accurate than Tesseract.js for colored text on backgrounds.
 * Requires: ollama running locally with a vision model (llama3.2-vision).
 */

import { ParsedCalendarShift } from './calendar-image-parser';

const OLLAMA_API = 'http://localhost:11434/api/generate';
const VISION_MODEL = 'llama3.2-vision:11b';

/**
 * Convert a File to base64 string for Ollama API
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Check if Ollama is available and has a vision model
 */
export async function checkOllamaAvailable(): Promise<{ available: boolean; model: string | null }> {
  try {
    const resp = await fetch('http://localhost:11434/api/tags');
    if (!resp.ok) return { available: false, model: null };
    
    const data = await resp.json();
    const models = data.models || [];
    
    // Look for vision-capable models (in order of preference)
    const visionModels = ['llama3.2-vision:11b', 'llama3.2-vision', 'llava', 'llava:13b', 'llava:7b'];
    for (const vm of visionModels) {
      if (models.some((m: any) => m.name === vm || m.name.startsWith(vm.split(':')[0]))) {
        return { available: true, model: vm };
      }
    }
    
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
  model?: string
): Promise<ParsedCalendarShift[]> {
  const base64Image = await fileToBase64(file);
  const useModel = model || VISION_MODEL;
  const currentYear = new Date().getFullYear();

  const prompt = `You are a precise data extraction tool. This image shows a monthly work schedule calendar from a mobile app. The current year is ${currentYear}.

TASK: Extract ALL work shifts from this calendar image into JSON format.

HOW TO READ THE CALENDAR:
- The calendar has 7 columns (Monday to Sunday) and 5-6 rows
- Each day cell shows a day number and may contain colored blocks with times
- Work shifts have TWO times stacked vertically: TOP = start time, BOTTOM = end time
- Days marked "Libre" or "TD" are days off - skip them
- Faded/gray days belong to previous or next month - skip them
- The month name appears at the top of the calendar

ANALYZE EACH ROW carefully. Look at EVERY single day from day 1 to day 31.
List ALL shifts you can see in the colored blocks.

OUTPUT FORMAT - respond with ONLY this JSON, no other text:
{"month":"${currentYear}-MM","shifts":[{"day":1,"start":"HH:MM","end":"HH:MM"}]}

Be exhaustive - there should be approximately 15-25 shifts in a typical month.`;

  console.log(`[Ollama] Sending image to ${useModel}...`);

  const response = await fetch(OLLAMA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: useModel,
      prompt,
      images: [base64Image],
      stream: false,
      options: {
        temperature: 0.05,
        num_predict: 8192,
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const rawResponse = result.response || '';
  
  console.log('[Ollama] Raw response:', rawResponse);

  // Extract JSON from response (might be wrapped in markdown code blocks)
  let jsonStr = rawResponse;
  const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // Try to find raw JSON object
    const objMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const monthStr = parsed.month || '';
    const [yearStr, monthNumStr] = monthStr.split('-');
    const year = parseInt(yearStr) || new Date().getFullYear();
    const monthNum = parseInt(monthNumStr) || (new Date().getMonth() + 1);

    const shifts: ParsedCalendarShift[] = (parsed.shifts || []).map((s: any) => ({
      date: `${year}-${String(monthNum).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`,
      startTime: s.start,
      endTime: s.end,
      isValid: true,
      confidence: 0.95,
      rawText: `${s.start} - ${s.end} (Ollama)`
    }));

    shifts.sort((a, b) => a.date.localeCompare(b.date));
    console.log(`[Ollama] Parsed ${shifts.length} shifts`);
    return shifts;
  } catch (e) {
    console.error('[Ollama] Failed to parse JSON:', e, '\nRaw:', jsonStr);
    throw new Error('El modelo no devolvió JSON válido. Revisa la consola.');
  }
}
