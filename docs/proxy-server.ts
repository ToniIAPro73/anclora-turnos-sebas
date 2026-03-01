/**
 * Shift Import Proxy Server
 * 
 * Standalone server that processes shift calendar images using Forge API
 * Implements vision and text-based shift extraction
 * 
 * Usage:
 *   NODE_ENV=development npx tsx proxy-server.ts
 * 
 * Endpoints:
 *   POST /api/shifts/extract - Extract shifts from image or text
 */

import express, { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const FORGE_API_URL = (process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.im").replace(/\/$/, "");
const PORT = parseInt(process.env.PORT || "3001", 10);
const NODE_ENV = process.env.NODE_ENV || "development";

// Validate required environment variables
if (!FORGE_API_KEY) {
  console.error("ERROR: BUILT_IN_FORGE_API_KEY is not set");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "50mb" }));

// Types
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

interface ExtractRequest {
  imageBase64?: string;
  ocrText?: string;
  month: number;
  year: number;
}

// Utility functions
function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1] || "Unknown";
}

function buildVisionPrompt(monthName: string, year: number): string {
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
- month: month number (can be ${12} for previous month, ${1} for current, ${2} for next)
- year: year number
- shiftType: "Regular" (for days with times), "Libre", "TD", or "JT"
- startTime: start time in HH:MM format (null if no times)
- endTime: end time in HH:MM format (null if no times)
- color: "blue" for Regular, "red" for Libre, "gray" for TD/JT
- notes: any notes (like "TD")

Return ONLY valid JSON array, no other text.`;
}

function buildTextPrompt(monthName: string, year: number, ocrText: string): string {
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
- month: month number (can be ${12} for previous month, ${1} for current, ${2} for next)
- year: year number
- shiftType: "Regular" (for days with times), "Libre", "TD", or "JT"
- startTime: start time in HH:MM format (null if no times)
- endTime: end time in HH:MM format (null if no times)
- color: "blue" for Regular, "red" for Libre, "gray" for TD/JT
- notes: any notes (like "TD")

Return ONLY valid JSON array, no other text.`;
}

// Forge API call
async function callForgeAPI(payload: Record<string, unknown>): Promise<ExtractedShift[]> {
  const response = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Forge API error: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const result = await response.json() as Record<string, unknown>;
  const content = (result.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from Forge API");
  }

  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  const shifts = JSON.parse(contentStr) as ExtractedShift[];

  // Filter to include only days with at least some information
  return shifts.filter((shift) => {
    const hasData = shift.shiftType || shift.notes || shift.startTime || shift.endTime;
    return hasData && shift.day >= 1 && shift.day <= 31 && shift.month && shift.year;
  });
}

// Vision mode: Process image
async function processWithVision(
  imageBase64: string,
  month: number,
  year: number,
  monthName: string
): Promise<ExtractedShift[]> {
  const imageUrl = `data:image/jpeg;base64,${imageBase64}`;
  const prompt = buildVisionPrompt(monthName, year);

  const payload = {
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content: "You are a work shift calendar analyzer. Analyze images of work schedules and extract shift data as JSON.",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high",
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    max_tokens: 32768,
    thinking: {
      budget_tokens: 128,
    },
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "shifts_extraction",
        strict: true,
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "number", description: "Day of month" },
              month: { type: "number", description: "Month" },
              year: { type: "number", description: "Year" },
              shiftType: { type: "string", description: "Type of shift" },
              startTime: { type: ["string", "null"], description: "Start time HH:MM or null" },
              endTime: { type: ["string", "null"], description: "End time HH:MM or null" },
              color: { type: "string", description: "Color code" },
              notes: { type: "string", description: "Notes" },
            },
            required: ["day", "month", "year", "shiftType", "color"],
          },
        },
      },
    },
  };

  return callForgeAPI(payload);
}

// Text mode: Process OCR text
async function processWithText(
  ocrText: string,
  month: number,
  year: number,
  monthName: string
): Promise<ExtractedShift[]> {
  const prompt = buildTextPrompt(monthName, year, ocrText);

  const payload = {
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content: "You are a work shift schedule parser. Extract shifts from OCR text and return valid JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 32768,
    thinking: {
      budget_tokens: 128,
    },
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "shifts_extraction",
        strict: true,
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "number", description: "Day of month" },
              month: { type: "number", description: "Month" },
              year: { type: "number", description: "Year" },
              shiftType: { type: "string", description: "Type of shift" },
              startTime: { type: ["string", "null"], description: "Start time HH:MM or null" },
              endTime: { type: ["string", "null"], description: "End time HH:MM or null" },
              color: { type: "string", description: "Color code" },
              notes: { type: "string", description: "Notes" },
            },
            required: ["day", "month", "year", "shiftType", "color"],
          },
        },
      },
    },
  };

  return callForgeAPI(payload);
}

// Routes
app.post("/api/shifts/extract", async (req: Request, res: Response) => {
  try {
    const { imageBase64, ocrText, month, year } = req.body as ExtractRequest;

    if (!month || !year) {
      return res.status(400).json({ error: "month and year are required" });
    }

    if (!imageBase64 && !ocrText) {
      return res.status(400).json({ error: "Either imageBase64 or ocrText is required" });
    }

    const monthName = getMonthName(month);
    let shifts: ExtractedShift[];

    if (imageBase64) {
      shifts = await processWithVision(imageBase64, month, year, monthName);
    } else if (ocrText) {
      shifts = await processWithText(ocrText, month, year, monthName);
    } else {
      return res.status(400).json({ error: "No valid input provided" });
    }

    res.json({
      success: true,
      shiftsCount: shifts.length,
      shifts,
    });
  } catch (error) {
    console.error("Error processing shifts:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    environment: NODE_ENV,
    forgeApiUrl: FORGE_API_URL,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Shift Import Proxy Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Forge API URL: ${FORGE_API_URL}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST /api/shifts/extract - Extract shifts from image or text`);
  console.log(`  GET /health - Health check`);
});
