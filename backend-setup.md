# Backend Setup para Procesamiento de Imágenes con Forge API

Este documento explica cómo configurar el backend para procesar imágenes de turnos usando Forge API.

## Estructura Requerida

Necesitas un backend (Express, FastAPI, etc.) que exponga estos endpoints:

### 1. POST `/api/shifts/extract-forge`

**Descripción:** Procesa una imagen de calendario y extrae los turnos usando Forge API con visión multimodal.

**Request:**
```
Content-Type: multipart/form-data

- image: File (JPEG, PNG, WebP)
- month: number (1-12)
- year: number (YYYY)
```

**Response:**
```json
{
  "shifts": [
    {
      "day": 1,
      "month": 3,
      "year": 2026,
      "shiftType": "Regular",
      "startTime": "17:00",
      "endTime": "01:00",
      "color": "blue",
      "notes": ""
    }
  ]
}
```

### 2. GET `/api/shifts/health`

**Descripción:** Verifica que el servicio está disponible.

**Response:**
```json
{ "status": "ok" }
```

## Configuración de Variables de Entorno

En el servidor backend, configura:

```env
# Forge API
BUILT_IN_FORGE_API_KEY=your_token_here
BUILT_IN_FORGE_API_URL=https://forge.manus.ai

# LLM Configuration
LLM_MODEL=gemini-2.5-flash
LLM_MAX_TOKENS=32768
LLM_THINKING_BUDGET=128

# Server
NODE_ENV=development
PORT=3000
```

## Implementación del Endpoint

### Paso 1: Instalar dependencias

```bash
npm install express multer axios
```

### Paso 2: Crear el endpoint

```typescript
import express, { Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

interface ExtractedShift {
  day: number;
  month: number;
  year: number;
  shiftType: string;
  startTime?: string | null;
  endTime?: string | null;
  color: string;
  notes?: string;
}

router.post('/shifts/extract-forge', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;
    const imageBuffer = req.file?.buffer;

    if (!imageBuffer || !month || !year) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Convert to base64
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    // Prepare prompt
    const monthName = new Date(year, month - 1).toLocaleString('es-ES', { month: 'long' });
    const prompt = `You are an expert at reading work shift schedules from calendar images.

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
- month: month number (can be ${month - 1} for previous month, ${month} for current, ${month + 1} for next)
- year: year number
- shiftType: "Regular" (for days with times), "Libre", "TD", or "JT"
- startTime: start time in HH:MM format (null if no times)
- endTime: end time in HH:MM format (null if no times)
- color: "blue" for Regular, "red" for Libre, "gray" for TD/JT
- notes: any notes (like "TD")

Return ONLY valid JSON array, no other text.`;

    // Call Forge API
    const response = await axios.post(
      `${process.env.BUILT_IN_FORGE_API_URL}/v1/chat/completions`,
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
          'Authorization': `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0]?.message.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const shifts: ExtractedShift[] = JSON.parse(content);
    
    // Filter empty days
    const filtered = shifts.filter(shift =>
      shift.shiftType || shift.notes || shift.startTime || shift.endTime
    );

    res.json({ shifts: filtered });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to extract shifts' });
  }
});

router.get('/shifts/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;
```

### Paso 3: Integrar en tu aplicación Express

```typescript
import express from 'express';
import shiftsRouter from './routes/shifts';

const app = express();
app.use(express.json());
app.use('/api', shiftsRouter);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Notas Importantes

- El token `BUILT_IN_FORGE_API_KEY` nunca se expone al cliente
- El endpoint es accesible solo desde el backend
- La imagen se procesa en el servidor, no en el cliente
- El modelo `gemini-2.5-flash` es el recomendado para visión multimodal
- El endpoint Forge es `https://forge.manus.ai` (no `.im`)

## Testing

```bash
curl -X POST http://localhost:3000/api/shifts/extract-forge \
  -F "image=@calendar.jpg" \
  -F "month=3" \
  -F "year=2026"
```
