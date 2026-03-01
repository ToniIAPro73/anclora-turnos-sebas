import { neon } from '@neondatabase/serverless';

function getConnectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

function getSql() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  return neon(connectionString);
}

function normalizeShiftDate(value) {
  const trimmed = String(value ?? '').trim();
  const match = trimmed.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    return trimmed;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function normalizeShift(raw) {
  return {
    id: String(raw?.id ?? '').trim(),
    date: normalizeShiftDate(raw?.date ?? ''),
    startTime: String(raw?.startTime ?? '').trim(),
    endTime: String(raw?.endTime ?? '').trim(),
    location: String(raw?.location ?? '').trim(),
    origin: raw?.origin === 'PDF' ? 'PDF' : 'IMG',
  };
}

export function validateShiftArray(value) {
  return Array.isArray(value) && value.every((item) => {
    const shift = normalizeShift(item);
    return Boolean(shift.id && shift.date && shift.location);
  });
}

async function ensureShiftsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      start_time TEXT NOT NULL DEFAULT '',
      end_time TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL,
      origin TEXT NOT NULL DEFAULT 'IMG',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS shifts_date_idx
    ON shifts (date)
  `;
}

export async function listShifts() {
  const sql = getSql();
  await ensureShiftsTable(sql);

  const rows = await sql`
    SELECT
      id,
      TO_CHAR(date, 'YYYY-MM-DD') AS date,
      start_time,
      end_time,
      location,
      origin
    FROM shifts
    ORDER BY date ASC, start_time ASC, id ASC
  `;

  return rows.map((row) => normalizeShift({
    id: row.id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    origin: row.origin,
  }));
}

export async function replaceAllShifts(rawShifts) {
  const shifts = rawShifts.map(normalizeShift);
  const sql = getSql();
  await ensureShiftsTable(sql);

  await sql`DELETE FROM shifts`;

  for (const shift of shifts) {
    await sql`
      INSERT INTO shifts (id, date, start_time, end_time, location, origin, updated_at)
      VALUES (${shift.id}, ${shift.date}, ${shift.startTime}, ${shift.endTime}, ${shift.location}, ${shift.origin}, NOW())
    `;
  }

  return shifts;
}
