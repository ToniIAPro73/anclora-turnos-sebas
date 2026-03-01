import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);
const MODEL = 'gemini-2.5-flash';

function loadEnvFile(filename) {
  const fullPath = path.join(ROOT, filename);
  if (!fs.existsSync(fullPath)) {
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');
loadEnvFile('.env.server');
loadEnvFile('.env.server.local');

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

function resolveForgeConfig() {
  const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL || process.env.FORGE_API_URL || 'https://forge.manus.im';
  const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY || process.env.FORGE_API_KEY || '';
  return {
    url: `${forgeApiUrl.replace(/\/$/, '')}/v1/chat/completions`,
    key: forgeApiKey,
  };
}

function getMonthNameEn(month) {
  return [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][month] ?? 'Unknown';
}

function buildVisionPrompt(month, year) {
  const monthNumber = month;
  const monthName = getMonthNameEn(month - 1);
  return `You are an expert at reading work shift schedules from calendar images.

I have a calendar image showing work shifts for ${monthName} ${year}.

Please analyze this calendar image and extract ALL shifts for EVERY day visible in the calendar.

IMPORTANT RULES:
1. Look at EVERY day cell in the calendar, including days from the previous month and next month if they appear
2. ONLY include days that have AT LEAST ONE piece of information: type, notes, start time, or end time
3. SKIP completely empty days (days with no information at all)
4. Each day may have:
   - A shift type label (like "JT", "TD", "Libre", "Regular")
   - Time ranges (like "17:00" and "01:00" on separate lines)
5. When a day has two times on separate lines, the first is START time, second is END time
6. "Libre" days are days off (no times, but may have "TD" as notes)
7. "TD" days are special days (no times)
8. Extract times in HH:MM format
9. Return ALL days with shift information (don't skip any with data, but skip empty days)
10. For days without explicit type, default to "Regular" if they have times, or "Libre" if they don't

Please return a JSON array with all shifts found. For each day:
- day: day of month (can be 1-31 for current month, or days from previous/next month)
- month: month number
- year: year number
- shiftType: "Regular" (for days with times), "Libre", "TD", or "JT"
- startTime: start time in HH:MM format (null if no times)
- endTime: end time in HH:MM format (null if no times)
- color: "blue" for Regular, "red" for Libre, "gray" for TD/JT
- notes: any notes (like "TD")

Return ONLY valid JSON array, no other text.`;
}

function buildTextPrompt(ocrText, month, year) {
  const monthName = getMonthNameEn(month - 1);
  return `You are an expert at reading work shift schedules from OCR text.

I have OCR-extracted text from a calendar image showing work shifts for ${monthName} ${year}.

OCR Text:
${ocrText}

Please analyze this text and extract ALL shifts for EVERY day visible in the calendar.

IMPORTANT RULES:
1. Look for EVERY day mentioned, including days from the previous month and next month if they appear
2. ONLY include days that have AT LEAST ONE piece of information: type, notes, start time, or end time
3. SKIP completely empty days (days with no information at all)
4. Each day may have:
   - A shift type label (like "JT", "TD", "Libre", "Regular")
   - Time ranges (like "17:00" and "01:00" on separate lines)
5. When a day has two times on separate lines, the first is START time, second is END time
6. "Libre" days are days off (no times, but may have "TD" as notes)
7. "TD" days are special days (no times)
8. Extract times in HH:MM format
9. Return ALL days with shift information (don't skip any with data, but skip empty days)
10. For days without explicit type, default to "Regular" if they have times, or "Libre" if they don't

Please return a JSON array with all shifts found. For each day:
- day: day of month (can be 1-31 for current month, or days from previous/next month)
- month: month number
- year: year number
- shiftType: "Regular" (for days with times), "Libre", "TD", or "JT"
- startTime: start time in HH:MM format (null if no times)
- endTime: end time in HH:MM format (null if no times)
- color: "blue" for Regular, "red" for Libre, "gray" for TD/JT
- notes: any notes (like "TD")

Return ONLY valid JSON array, no other text.`;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function extractJsonArray(rawResponse) {
  const content = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse);
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? content;
  const arrayStart = candidate.indexOf('[');
  const arrayEnd = candidate.lastIndexOf(']');

  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return JSON.parse(candidate.slice(arrayStart, arrayEnd + 1));
  }

  throw new Error('Forge no devolvio un array JSON valido.');
}

async function invokeForge(messages) {
  const forge = resolveForgeConfig();
  if (!forge.key) {
    throw new Error('Falta BUILT_IN_FORGE_API_KEY o FORGE_API_KEY en el backend.');
  }

  const response = await fetch(forge.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${forge.key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 32768,
      thinking: {
        budget_tokens: 128,
      },
      response_format: {
        type: 'json_object',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Forge error: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content ?? '';
}

async function handleShiftVision(request, response) {
  const body = await readJsonBody(request);
  const { imageBase64, mimeType, month, year } = body;

  if (!imageBase64 || typeof month !== 'number' || typeof year !== 'number') {
    return json(response, 400, { error: 'Payload invalido para shift-vision.' });
  }

  const content = await invokeForge([
    {
      role: 'system',
      content: 'You are a work shift calendar analyzer. Analyze images of work schedules and extract shift data as JSON.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType || 'image/png'};base64,${imageBase64}`,
            detail: 'high',
          },
        },
        {
          type: 'text',
          text: buildVisionPrompt(month, year),
        },
      ],
    },
  ]);

  return json(response, 200, { shifts: extractJsonArray(content) });
}

async function handleShiftText(request, response) {
  const body = await readJsonBody(request);
  const { ocrText, month, year } = body;

  if (!ocrText || typeof month !== 'number' || typeof year !== 'number') {
    return json(response, 400, { error: 'Payload invalido para shift-text.' });
  }

  const content = await invokeForge([
    {
      role: 'system',
      content: 'You are a work shift schedule parser. Extract shifts from OCR text and return valid JSON.',
    },
    {
      role: 'user',
      content: buildTextPrompt(ocrText, month, year),
    },
  ]);

  return json(response, 200, { shifts: extractJsonArray(content) });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      return json(response, 200, { ok: true });
    }

    if (request.method === 'GET' && request.url === '/health') {
      const forge = resolveForgeConfig();
      return json(response, 200, {
        status: 'ok',
        environment: process.env.NODE_ENV || 'development',
        forgeApiUrl: forge.url.replace(/\/v1\/chat\/completions$/, ''),
        available: Boolean(forge.key),
        model: forge.key ? MODEL : null,
      });
    }

    if (request.method === 'POST' && request.url === '/api/shifts/extract') {
      const body = await readJsonBody(request);
      const { imageBase64, ocrText, month, year, mimeType } = body;

      if (!month || !year) {
        return json(response, 400, { error: 'month and year are required' });
      }

      if (!imageBase64 && !ocrText) {
        return json(response, 400, { error: 'Either imageBase64 or ocrText is required' });
      }

      let shifts;
      if (imageBase64) {
        shifts = await (async () => {
          const content = await invokeForge([
            {
              role: 'system',
              content: 'You are a work shift calendar analyzer. Analyze images of work schedules and extract shift data as JSON.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
                    detail: 'high',
                  },
                },
                {
                  type: 'text',
                  text: buildVisionPrompt(month, year),
                },
              ],
            },
          ]);
          return extractJsonArray(content);
        })();
      } else {
        shifts = await (async () => {
          const content = await invokeForge([
            {
              role: 'system',
              content: 'You are a work shift schedule parser. Extract shifts from OCR text and return valid JSON.',
            },
            {
              role: 'user',
              content: buildTextPrompt(ocrText, month, year),
            },
          ]);
          return extractJsonArray(content);
        })();
      }

      return json(response, 200, {
        success: true,
        shiftsCount: shifts.length,
        shifts,
      });
    }

    return json(response, 404, { error: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return json(response, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`);
});
