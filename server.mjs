import express from 'express';
import multer from 'multer';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportToExcel, exportToJSON } from './server-export.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// Get port from environment or use default
const PORT = process.env.PORT || 3001;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.ai';
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!FORGE_API_KEY) {
  console.error('ERROR: BUILT_IN_FORGE_API_KEY is not set in environment variables');
  process.exit(1);
}

/**
 * POST /api/shifts/extract-forge
 * Procesa una imagen de calendario y extrae los turnos usando Forge API
 */
app.post('/api/shifts/extract-forge', upload.single('image'), async (req, res) => {
  try {
    const { month, year } = req.body;
    const imageBuffer = req.file?.buffer;

    if (!imageBuffer || !month || !year) {
      return res.status(400).json({ 
        message: 'Missing required fields: image, month, year' 
      });
    }

    console.log(`[Forge] Processing image for ${month}/${year}`);

    // Convert to base64
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    // Prepare prompt
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = monthNames[monthNum - 1] || 'Unknown';

    const prompt = `You are an expert at reading work shift schedules from calendar images.

I have a calendar image showing work shifts for ${monthName} ${yearNum}.

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
- month: month number (can be ${monthNum - 1} for previous month, ${monthNum} for current, ${monthNum + 1} for next)
- year: year number
- shiftType: "Regular" (for days with times), "Libre", "TD", or "JT"
- startTime: start time in HH:MM format (null if no times)
- endTime: end time in HH:MM format (null if no times)
- color: "blue" for Regular, "red" for Libre, "gray" for TD/JT
- notes: any notes (like "TD")

Return ONLY valid JSON array, no other text.`;

    // Call Forge API
    const response = await axios.post(
      `${FORGE_API_URL}/v1/chat/completions`,
      {
        messages: [
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
                  url: imageUrl,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        model: 'gemini-2.5-flash',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'shifts_extraction',
            strict: true,
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day: { type: 'number', description: 'Day of month' },
                  month: { type: 'number', description: 'Month' },
                  year: { type: 'number', description: 'Year' },
                  shiftType: { type: 'string', description: 'Type of shift' },
                  startTime: { type: ['string', 'null'], description: 'Start time HH:MM or null' },
                  endTime: { type: ['string', 'null'], description: 'End time HH:MM or null' },
                  color: { type: 'string', description: 'Color code' },
                  notes: { type: 'string', description: 'Notes' },
                },
                required: ['day', 'month', 'year', 'shiftType', 'color'],
              },
            },
          },
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${FORGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0]?.message.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const shifts = JSON.parse(content);
    
    // Filter empty days
    const filtered = shifts.filter(shift =>
      shift.shiftType || shift.notes || shift.startTime || shift.endTime
    );

    console.log(`[Forge] Extracted ${filtered.length} shifts`);
    res.json({ shifts: filtered });
  } catch (error) {
    console.error('[Forge] Error:', error.message);
    res.status(500).json({ 
      message: `Failed to extract shifts: ${error.message}` 
    });
  }
});

/**
 * POST /api/shifts/export-excel
 * Exporta turnos a formato Excel con tabla de calendario
 */
app.post('/api/shifts/export-excel', express.json(), async (req, res) => {
  try {
    const { shifts, month, year } = req.body;

    if (!shifts || !Array.isArray(shifts) || !month || !year) {
      return res.status(400).json({ 
        message: 'Missing required fields: shifts (array), month, year' 
      });
    }

    console.log(`[Export] Generating Excel for ${month}/${year} with ${shifts.length} shifts`);

    const buffer = await exportToExcel(shifts, parseInt(month), parseInt(year));
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="turnos-${year}-${String(month).padStart(2, '0')}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('[Export] Excel error:', error);
    res.status(500).json({ 
      message: `Failed to export Excel: ${error.message}` 
    });
  }
});

/**
 * POST /api/shifts/export-json
 * Exporta turnos a formato JSON
 */
app.post('/api/shifts/export-json', express.json(), (req, res) => {
  try {
    const { shifts } = req.body;

    if (!shifts || !Array.isArray(shifts)) {
      return res.status(400).json({ 
        message: 'Missing required field: shifts (array)' 
      });
    }

    console.log(`[Export] Generating JSON with ${shifts.length} shifts`);

    const json = exportToJSON(shifts);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="turnos.json"');
    res.send(json);
  } catch (error) {
    console.error('[Export] JSON error:', error);
    res.status(500).json({ 
      message: `Failed to export JSON: ${error.message}` 
    });
  }
});

/**
 * GET /api/shifts/health
 * Verifica que el servicio está disponible
 */
app.get('/api/shifts/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from Vite build (if available)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ message: 'Not found' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] Forge API: ${FORGE_API_URL}`);
});
