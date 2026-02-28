import { createWorker } from 'tesseract.js';
import { getDaysInMonth, getFirstWeekdayOfMonth } from './week';

export interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  source: string;
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
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const WEEKDAY_HEADER_RE = /^(l|m|x|j|v|s|d)$/i;

interface OcrPassResult {
  blocks: TextBlock[];
  rawText: string;
}

interface ImageSlice {
  name: string;
  canvas: HTMLCanvasElement;
  offsetX: number;
  offsetY: number;
}

interface CalendarCell {
  day: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface CellOcrResult {
  day: number;
  isOffDay: boolean;
  shift: ParsedCalendarShift | null;
  rawText: string;
}

function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo crear el contexto del canvas.'));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas);
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };

    img.src = objectUrl;
  });
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo clonar el canvas.');
  }

  ctx.drawImage(source, 0, 0);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo convertir el canvas a imagen.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function applyContrastVariant(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo preparar la variante de contraste.');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const contrast = ((luminance - 128) * 2.1) + 128;
    const boosted = Math.max(0, Math.min(255, contrast));
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function applyColorLiftVariant(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo preparar la variante cromatica.');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max - min;
    const lift = saturation > 18 ? 1.12 : 1.02;

    data[i] = Math.max(0, Math.min(255, (r - 128) * lift + 128));
    data[i + 1] = Math.max(0, Math.min(255, (g - 128) * lift + 128));
    data[i + 2] = Math.max(0, Math.min(255, (b - 128) * lift + 128));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function cropCanvas(source: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo crear el canvas del recorte.');
  }

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

function buildRegionalSlices(source: HTMLCanvasElement): ImageSlice[] {
  const slices: ImageSlice[] = [];
  const startY = Math.floor(source.height * 0.17);
  const endY = Math.floor(source.height * 0.92);
  const usableHeight = endY - startY;
  const bands = 6;
  const overlap = Math.floor(usableHeight * 0.03);

  for (let index = 0; index < bands; index += 1) {
    const rawTop = startY + Math.floor((usableHeight / bands) * index) - overlap;
    const rawBottom = startY + Math.floor((usableHeight / bands) * (index + 1)) + overlap;
    const top = Math.max(0, rawTop);
    const bottom = Math.min(source.height, rawBottom);

    slices.push({
      name: `band-${index + 1}`,
      canvas: cropCanvas(source, 0, top, source.width, bottom - top),
      offsetX: 0,
      offsetY: top,
    });
  }

  const calendarFocus = cropCanvas(
    source,
    0,
    Math.floor(source.height * 0.12),
    source.width,
    Math.floor(source.height * 0.78),
  );

  const calendarFocusTop = Math.floor(source.height * 0.12);
  slices.push({ name: 'calendar-focus', canvas: calendarFocus, offsetX: 0, offsetY: calendarFocusTop });
  slices.push({
    name: 'calendar-focus-contrast',
    canvas: applyContrastVariant(calendarFocus),
    offsetX: 0,
    offsetY: calendarFocusTop,
  });

  return slices;
}

function sanitizeText(text: string): string {
  return text
    .replace(/[|¦]/g, ' ')
    .replace(/[‘’´`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTime(raw: string): string | null {
  const normalized = raw
    .trim()
    .replace(/[oO]/g, '0')
    .replace(/[lI]/g, '1')
    .replace(/[.,;]/g, ':')
    .replace(/\s+/g, '');

  let match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    match = normalized.match(/^(\d{2})(\d{2})$/);
  }
  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour > 23 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function extractTimesFromLine(line: string): string[] {
  const tokens = sanitizeText(line).split(/\s+/).filter(Boolean);
  const times: string[] = [];

  for (const token of tokens) {
    const normalized = normalizeTime(token);
    if (normalized) {
      times.push(normalized);
    }
  }

  return times;
}

function splitIntoColumns(line: string): string[] {
  const cleaned = sanitizeText(line);
  if (!cleaned) {
    return [];
  }

  if (cleaned.includes('|')) {
    return cleaned
      .split('|')
      .map((part) => sanitizeText(part))
      .filter(Boolean);
  }

  return cleaned.split(/\s+/).filter(Boolean);
}

function parseMinutes(time: string): number | null {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour > 23 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

function formatMinutes(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function shiftDurationHours(startTime: string, endTime: string): number | null {
  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  if (start === null || end === null) {
    return null;
  }

  let resolvedEnd = end;
  if (resolvedEnd <= start) {
    resolvedEnd += 24 * 60;
  }

  return (resolvedEnd - start) / 60;
}

function scoreShiftCandidate(shift: ParsedCalendarShift): number {
  const hasStart = shift.startTime !== '??:??';
  const hasEnd = shift.endTime !== '??:??';
  const duration = hasStart && hasEnd ? shiftDurationHours(shift.startTime, shift.endTime) : null;
  const sameTime = hasStart && hasEnd && shift.startTime === shift.endTime;
  const plausibleDuration = duration !== null && duration >= 3 && duration <= 12;

  let score = Math.round(shift.confidence * 100);
  if (hasStart) score += 60;
  if (hasEnd) score += 60;
  if (shift.isValid) score += 40;
  if (plausibleDuration) score += 80;
  if (sameTime) score -= 180;
  if (duration !== null && !plausibleDuration) score -= 120;

  return score;
}

function chooseBetterShift(left: ParsedCalendarShift, right: ParsedCalendarShift): ParsedCalendarShift {
  return scoreShiftCandidate(right) > scoreShiftCandidate(left) ? right : left;
}

function isCompleteShift(shift: ParsedCalendarShift): boolean {
  return shift.startTime !== '??:??' && shift.endTime !== '??:??';
}

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dayDistance(a: string, b: string): number {
  const left = parseIsoDate(a).getTime();
  const right = parseIsoDate(b).getTime();
  return Math.round(Math.abs(left - right) / (24 * 60 * 60 * 1000));
}

function inferMissingShiftTimes(shifts: ParsedCalendarShift[]): ParsedCalendarShift[] {
  const complete = shifts.filter(isCompleteShift);
  const completeStarts = new Map<string, number>();
  const completeEnds = new Map<string, number>();
  const pairByEnd = new Map<string, Map<string, number>>();
  const pairByStart = new Map<string, Map<string, number>>();
  const durationCounts = new Map<number, number>();

  for (const shift of complete) {
    completeStarts.set(shift.startTime, (completeStarts.get(shift.startTime) ?? 0) + 1);
    completeEnds.set(shift.endTime, (completeEnds.get(shift.endTime) ?? 0) + 1);

    if (!pairByEnd.has(shift.endTime)) pairByEnd.set(shift.endTime, new Map<string, number>());
    if (!pairByStart.has(shift.startTime)) pairByStart.set(shift.startTime, new Map<string, number>());

    const byEnd = pairByEnd.get(shift.endTime)!;
    byEnd.set(shift.startTime, (byEnd.get(shift.startTime) ?? 0) + 1);

    const byStart = pairByStart.get(shift.startTime)!;
    byStart.set(shift.endTime, (byStart.get(shift.endTime) ?? 0) + 1);

    const durationHours = shiftDurationHours(shift.startTime, shift.endTime);
    if (durationHours !== null) {
      const durationMinutes = Math.round(durationHours * 60);
      durationCounts.set(durationMinutes, (durationCounts.get(durationMinutes) ?? 0) + 1);
    }
  }

  const commonDurations = Array.from(durationCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([minutes]) => minutes);

  return shifts.map((shift) => {
    if (isCompleteShift(shift)) {
      return shift;
    }

    const hasStart = shift.startTime !== '??:??';
    const hasEnd = shift.endTime !== '??:??';
    if (hasStart === hasEnd) {
      return shift;
    }

    const candidateScores = new Map<string, number>();
    const neighbors = complete.filter((candidate) => dayDistance(candidate.date, shift.date) <= 2);

    if (!hasStart && hasEnd) {
      const matchedStarts = pairByEnd.get(shift.endTime);
      if (matchedStarts) {
        for (const [startTime, count] of matchedStarts.entries()) {
          candidateScores.set(startTime, (candidateScores.get(startTime) ?? 0) + (count * 25));
        }
      }

      const endMinutes = parseMinutes(shift.endTime);
      if (endMinutes !== null) {
        for (const duration of commonDurations) {
          const candidateStart = formatMinutes(endMinutes - duration);
          candidateScores.set(candidateStart, (candidateScores.get(candidateStart) ?? 0) + 12);
        }
      }

      for (const neighbor of neighbors) {
        candidateScores.set(neighbor.startTime, (candidateScores.get(neighbor.startTime) ?? 0) + 10);
      }

      for (const [startTime, count] of completeStarts.entries()) {
        candidateScores.set(startTime, (candidateScores.get(startTime) ?? 0) + count);
      }

      let bestStart = shift.startTime;
      let bestScore = -1;
      for (const [candidateStart, score] of candidateScores.entries()) {
        const duration = shiftDurationHours(candidateStart, shift.endTime);
        if (duration === null || duration < 3 || duration > 12) {
          continue;
        }
        const adjusted = score + (duration >= 6 && duration <= 9 ? 10 : 0);
        if (adjusted > bestScore) {
          bestScore = adjusted;
          bestStart = candidateStart;
        }
      }

      if (bestStart !== '??:??') {
        return {
          ...shift,
          startTime: bestStart,
          endTime: shift.endTime,
          isValid: true,
          confidence: Math.max(shift.confidence, 0.58),
          rawText: `${shift.rawText} || infer:${bestStart}-${shift.endTime}`,
        };
      }
    }

    if (hasStart && !hasEnd) {
      const matchedEnds = pairByStart.get(shift.startTime);
      if (matchedEnds) {
        for (const [endTime, count] of matchedEnds.entries()) {
          candidateScores.set(endTime, (candidateScores.get(endTime) ?? 0) + (count * 25));
        }
      }

      const startMinutes = parseMinutes(shift.startTime);
      if (startMinutes !== null) {
        for (const duration of commonDurations) {
          const candidateEnd = formatMinutes(startMinutes + duration);
          candidateScores.set(candidateEnd, (candidateScores.get(candidateEnd) ?? 0) + 12);
        }
      }

      for (const neighbor of neighbors) {
        candidateScores.set(neighbor.endTime, (candidateScores.get(neighbor.endTime) ?? 0) + 10);
      }

      for (const [endTime, count] of completeEnds.entries()) {
        candidateScores.set(endTime, (candidateScores.get(endTime) ?? 0) + count);
      }

      let bestEnd = shift.endTime;
      let bestScore = -1;
      for (const [candidateEnd, score] of candidateScores.entries()) {
        const duration = shiftDurationHours(shift.startTime, candidateEnd);
        if (duration === null || duration < 3 || duration > 12) {
          continue;
        }
        const adjusted = score + (duration >= 6 && duration <= 9 ? 10 : 0);
        if (adjusted > bestScore) {
          bestScore = adjusted;
          bestEnd = candidateEnd;
        }
      }

      if (bestEnd !== '??:??') {
        return {
          ...shift,
          startTime: shift.startTime,
          endTime: bestEnd,
          isValid: true,
          confidence: Math.max(shift.confidence, 0.58),
          rawText: `${shift.rawText} || infer:${shift.startTime}-${bestEnd}`,
        };
      }
    }

    return shift;
  });
}

function consolidateShiftCandidates(candidates: ParsedCalendarShift[]): ParsedCalendarShift[] {
  const byDate = new Map<string, ParsedCalendarShift>();

  for (const candidate of candidates) {
    const existing = byDate.get(candidate.date);
    if (!existing) {
      byDate.set(candidate.date, candidate);
      continue;
    }

    byDate.set(candidate.date, chooseBetterShift(existing, candidate));
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clusterCoordinateValues(values: number[], threshold: number): number[] {
  if (values.length === 0) {
    return [];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];

  for (let index = 1; index < sorted.length; index += 1) {
    const value = sorted[index];
    const currentCluster = clusters[clusters.length - 1];
    const currentCenter = average(currentCluster);

    if (Math.abs(value - currentCenter) <= threshold) {
      currentCluster.push(value);
      continue;
    }

    clusters.push([value]);
  }

  return clusters.map((cluster) => average(cluster));
}

function coordinateEdges(centers: number[], maxExtent: number): number[] {
  if (centers.length === 0) {
    return [0, maxExtent];
  }

  const sortedCenters = [...centers].sort((a, b) => a - b);
  const edges: number[] = [];

  const firstGap = sortedCenters[1] ? (sortedCenters[1] - sortedCenters[0]) / 2 : maxExtent / 14;
  edges.push(Math.max(0, sortedCenters[0] - firstGap));

  for (let index = 0; index < sortedCenters.length - 1; index += 1) {
    edges.push((sortedCenters[index] + sortedCenters[index + 1]) / 2);
  }

  const lastGap = sortedCenters[sortedCenters.length - 2]
    ? (sortedCenters[sortedCenters.length - 1] - sortedCenters[sortedCenters.length - 2]) / 2
    : maxExtent / 14;
  edges.push(Math.min(maxExtent, sortedCenters[sortedCenters.length - 1] + lastGap));

  return edges;
}

function extractBlockDay(block: TextBlock): number | null {
  const text = block.text.trim();
  if (!/^\d{1,2}$/.test(text)) {
    return null;
  }

  const day = Number.parseInt(text, 10);
  if (day < 1 || day > 31) {
    return null;
  }

  return day;
}

function findDayCandidates(blocks: TextBlock[]): Array<TextBlock & { day: number; centerX: number; centerY: number }> {
  return blocks
    .map((block) => {
      const day = extractBlockDay(block);
      if (day === null) {
        return null;
      }

      return {
        ...block,
        day,
        centerX: block.x + block.width / 2,
        centerY: block.y + block.height / 2,
      };
    })
    .filter((block): block is TextBlock & { day: number; centerX: number; centerY: number } => {
      return block !== null && block.confidence >= 35;
    });
}

function nearestCenterIndex(value: number, centers: number[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < centers.length; index += 1) {
    const distance = Math.abs(centers[index] - value);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function buildCalendarCells(blocks: TextBlock[], month: number, year: number): CalendarCell[] {
  const dayCandidates = findDayCandidates(blocks);
  if (dayCandidates.length < 10) {
    return [];
  }

  const avgDayWidth = average(dayCandidates.map((block) => block.width)) || 40;
  const avgDayHeight = average(dayCandidates.map((block) => block.height)) || 24;
  const columnCenters = clusterCoordinateValues(
    dayCandidates.map((block) => block.centerX),
    Math.max(18, avgDayWidth * 0.9),
  );
  const rowCenters = clusterCoordinateValues(
    dayCandidates.map((block) => block.centerY),
    Math.max(16, avgDayHeight * 1.4),
  );

  if (columnCenters.length < 7 || rowCenters.length < 5) {
    return [];
  }

  const sortedColumns = columnCenters.sort((a, b) => a - b).slice(0, 7);
  const sortedRows = rowCenters.sort((a, b) => a - b);
  const firstWeekday = getFirstWeekdayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  const possibleStarts = dayCandidates
    .filter((block) => block.day === 1)
    .map((block) => ({
      rowIndex: nearestCenterIndex(block.centerY, sortedRows),
      columnIndex: nearestCenterIndex(block.centerX, sortedColumns),
      block,
      columnDistance: Math.abs(nearestCenterIndex(block.centerX, sortedColumns) - firstWeekday),
    }))
    .sort((left, right) => {
      if (left.columnDistance !== right.columnDistance) {
        return left.columnDistance - right.columnDistance;
      }
      return left.block.centerY - right.block.centerY;
    });

  const start = possibleStarts.find((candidate) => candidate.columnIndex === firstWeekday) ?? possibleStarts[0];
  if (!start) {
    return [];
  }

  const xEdges = coordinateEdges(sortedColumns, Math.max(...blocks.map((block) => block.x + block.width), 0));
  const yEdges = coordinateEdges(sortedRows, Math.max(...blocks.map((block) => block.y + block.height), 0));

  const cells: CalendarCell[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const offset = firstWeekday + day - 1;
    const rowIndex = start.rowIndex + Math.floor(offset / 7);
    const columnIndex = offset % 7;

    if (rowIndex >= sortedRows.length || columnIndex >= sortedColumns.length) {
      continue;
    }

    cells.push({
      day,
      left: xEdges[columnIndex],
      right: xEdges[columnIndex + 1],
      top: yEdges[rowIndex],
      bottom: yEdges[rowIndex + 1] ?? yEdges[yEdges.length - 1],
    });
  }

  return cells;
}

function buildApproxCalendarCells(imageWidth: number, imageHeight: number, month: number, year: number): CalendarCell[] {
  const gridLeft = imageWidth * 0.02;
  const gridRight = imageWidth * 0.98;
  const gridTop = imageHeight * 0.22;
  const gridBottom = imageHeight * 0.90;
  const gridWidth = gridRight - gridLeft;
  const gridHeight = gridBottom - gridTop;
  const columnWidth = gridWidth / 7;
  const rowHeight = gridHeight / 6;
  const firstWeekday = getFirstWeekdayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const cells: CalendarCell[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const offset = firstWeekday + day - 1;
    const columnIndex = offset % 7;
    const rowIndex = Math.floor(offset / 7);

    cells.push({
      day,
      left: gridLeft + (columnIndex * columnWidth),
      right: gridLeft + ((columnIndex + 1) * columnWidth),
      top: gridTop + (rowIndex * rowHeight),
      bottom: gridTop + ((rowIndex + 1) * rowHeight),
    });
  }

  return cells;
}

function parseShiftsFromBlocks(
  blocks: TextBlock[],
  month: number,
  year: number,
  imageWidth?: number,
  imageHeight?: number,
): ParsedCalendarShift[] {
  const cells = buildCalendarCells(blocks, month, year);
  const fallbackCells = imageWidth && imageHeight ? buildApproxCalendarCells(imageWidth, imageHeight, month, year) : [];
  const activeCells = cells.length > 0 ? cells : fallbackCells;
  if (activeCells.length === 0) {
    return [];
  }

  const results: ParsedCalendarShift[] = [];

  for (const cell of activeCells) {
    const cellBlocks = blocks
      .filter((block) => {
        const centerX = block.x + block.width / 2;
        const centerY = block.y + block.height / 2;
        return centerX >= cell.left && centerX <= cell.right && centerY >= cell.top && centerY <= cell.bottom;
      })
      .sort((left, right) => left.y - right.y || left.x - right.x);

    if (cellBlocks.length === 0) {
      continue;
    }

    const markerText = cellBlocks.map((block) => block.text).join(' ');
    if (/libre|td/i.test(markerText) && !/\d{1,2}[:.,]?\d{2}/.test(markerText)) {
      continue;
    }

    const orderedTimes = cellBlocks
      .map((block) => ({
        y: block.y,
        time: normalizeTime(block.text),
      }))
      .filter((entry): entry is { y: number; time: string } => Boolean(entry.time))
      .sort((left, right) => left.y - right.y)
      .map((entry) => entry.time);

    if (orderedTimes.length === 0) {
      continue;
    }

    const startTime = orderedTimes[0] ?? '??:??';
    const endTime = orderedTimes[1] ?? '??:??';

    results.push({
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`,
      startTime,
      endTime,
      isValid: startTime !== '??:??' && endTime !== '??:??',
      confidence: startTime !== '??:??' && endTime !== '??:??' ? 0.88 : 0.58,
      rawText: cellBlocks.map((block) => block.text).join(' | '),
    });
  }

  return consolidateShiftCandidates(results);
}

function cropCellForOcr(source: HTMLCanvasElement, cell: CalendarCell, variant: 'focused' | 'extended'): HTMLCanvasElement {
  const cellWidth = cell.right - cell.left;
  const cellHeight = cell.bottom - cell.top;
  const insetX = Math.max(5, Math.floor(cellWidth * (variant === 'focused' ? 0.09 : 0.07)));
  const topInset = Math.max(4, Math.floor(cellHeight * 0.06));
  const usableHeight = Math.floor(cellHeight * (variant === 'focused' ? 0.48 : 0.62));
  const left = Math.max(0, Math.floor(cell.left + insetX));
  const right = Math.min(source.width, Math.ceil(cell.right - insetX));
  const top = Math.max(0, Math.floor(cell.top + topInset));
  const bottom = Math.min(source.height, top + Math.max(20, usableHeight));

  return cropCanvas(source, left, top, Math.max(1, right - left), Math.max(1, bottom - top));
}

function uniqueTimesInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function scoreTimePair(startTime: string, endTime: string, frequencies: Map<string, number>): number {
  const duration = shiftDurationHours(startTime, endTime);
  if (duration === null) {
    return -1_000;
  }

  let score = 0;
  score += (frequencies.get(startTime) ?? 0) * 10;
  score += (frequencies.get(endTime) ?? 0) * 12;

  if (duration >= 3 && duration <= 12) score += 40;
  if (duration >= 6 && duration <= 9) score += 35;
  if (duration >= 7 && duration <= 8.5) score += 15;
  if (duration < 3 || duration > 12) score -= 80;

  return score;
}

function chooseBestTimePair(times: string[]): { startTime: string; endTime: string } | null {
  const uniqueTimes = uniqueTimesInOrder(times);
  if (uniqueTimes.length < 2) {
    return null;
  }

  const frequencies = new Map<string, number>();
  for (const time of times) {
    frequencies.set(time, (frequencies.get(time) ?? 0) + 1);
  }

  let bestPair: { startTime: string; endTime: string } | null = null;
  let bestScore = -1_000;

  for (let startIndex = 0; startIndex < uniqueTimes.length; startIndex += 1) {
    for (let endIndex = 0; endIndex < uniqueTimes.length; endIndex += 1) {
      if (startIndex === endIndex) {
        continue;
      }

      const startTime = uniqueTimes[startIndex];
      const endTime = uniqueTimes[endIndex];
      const score = scoreTimePair(startTime, endTime, frequencies);

      if (score > bestScore) {
        bestScore = score;
        bestPair = { startTime, endTime };
      }
    }
  }

  return bestPair;
}

function parseCellOcrResult(
  day: number,
  month: number,
  year: number,
  blocks: TextBlock[],
  rawText: string,
): CellOcrResult {
  const filteredBlocks = blocks
    .filter((block) => {
      const text = sanitizeText(block.text);
      return text !== String(day);
    })
    .sort((left, right) => left.y - right.y || left.x - right.x);

  const normalizedRawText = sanitizeText(rawText);
  const combinedText = `${normalizedRawText} ${filteredBlocks.map((block) => block.text).join(' ')}`.toLowerCase();
  const isOffDay = /libre|td/.test(combinedText) && !/\d{1,2}[:.,]?\d{2}/.test(combinedText);

  if (isOffDay) {
    return { day, isOffDay: true, shift: null, rawText: normalizedRawText };
  }

  const timesFromBlocks = filteredBlocks
    .map((block) => ({ y: block.y, time: normalizeTime(block.text) }))
    .filter((entry): entry is { y: number; time: string } => Boolean(entry.time))
    .sort((left, right) => left.y - right.y)
    .map((entry) => entry.time);

  const positionedTimes = filteredBlocks
    .map((block) => ({ centerY: block.y + (block.height / 2), time: normalizeTime(block.text) }))
    .filter((entry): entry is { centerY: number; time: string } => Boolean(entry.time));

  const timesFromText = normalizedRawText
    .split(/\s+/)
    .map((token) => normalizeTime(token))
    .filter((value): value is string => Boolean(value));

  const allTimes = [...timesFromBlocks, ...timesFromText];
  const uniqueTimes = uniqueTimesInOrder(allTimes);

  if (uniqueTimes.length === 0) {
    return { day, isOffDay: false, shift: null, rawText: normalizedRawText };
  }

  let startTime = '??:??';
  let endTime = '??:??';

  const pair = chooseBestTimePair(allTimes);
  if (pair) {
    startTime = pair.startTime;
    endTime = pair.endTime;
  } else {
    const onlyTime = uniqueTimes[0];
    const avgCenterY = positionedTimes.length > 0
      ? average(positionedTimes.map((entry) => entry.centerY))
      : 0;
    const minY = filteredBlocks.length > 0 ? Math.min(...filteredBlocks.map((block) => block.y)) : 0;
    const maxY = filteredBlocks.length > 0 ? Math.max(...filteredBlocks.map((block) => block.y + block.height)) : 0;
    const midY = minY + ((maxY - minY) / 2);

    if (avgCenterY > midY) {
      endTime = onlyTime;
    } else {
      startTime = onlyTime;
    }
  }

  return {
    day,
    isOffDay: false,
    shift: {
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      startTime,
      endTime,
      isValid: startTime !== '??:??' && endTime !== '??:??',
      confidence: startTime !== '??:??' && endTime !== '??:??' ? 0.92 : 0.6,
      rawText: normalizedRawText,
    },
    rawText: normalizedRawText,
  };
}

async function ocrCalendarCells(
  worker: Tesseract.Worker,
  primaryCanvas: HTMLCanvasElement,
  secondaryCanvas: HTMLCanvasElement,
  cells: CalendarCell[],
  month: number,
  year: number,
): Promise<CellOcrResult[]> {
  const results: CellOcrResult[] = [];

  for (const cell of cells) {
    const focusedPrimary = cropCellForOcr(primaryCanvas, cell, 'focused');
    const extendedPrimary = cropCellForOcr(primaryCanvas, cell, 'extended');
    const focusedSecondary = cropCellForOcr(secondaryCanvas, cell, 'focused');

    const passes = await Promise.all([
      runOcrPass(worker, focusedPrimary, `cell-focused-${cell.day}`),
      runOcrPass(worker, extendedPrimary, `cell-extended-${cell.day}`),
      runOcrPass(worker, focusedSecondary, `cell-secondary-${cell.day}`),
    ]);

    const cellBlocks = dedupeBlocks(passes.flatMap((pass) => pass.blocks));
    const cellText = passes.map((pass) => pass.rawText).join(' ');
    results.push(parseCellOcrResult(cell.day, month, year, cellBlocks, cellText));
  }

  return results;
}

function applyCellOcrCorrections(
  merged: ParsedCalendarShift[],
  cellResults: CellOcrResult[],
): ParsedCalendarShift[] {
  const byDate = new Map(merged.map((shift) => [shift.date, shift] as const));

  for (const result of cellResults) {
    if (result.isOffDay && result.shift === null) {
      const matching = Array.from(byDate.keys()).find((key) => key.endsWith(`-${String(result.day).padStart(2, '0')}`));
      if (matching) {
        byDate.delete(matching);
      }
      continue;
    }

    if (!result.shift) {
      continue;
    }

    const existing = byDate.get(result.shift.date);
    if (!existing) {
      byDate.set(result.shift.date, result.shift);
      continue;
    }

    byDate.set(result.shift.date, chooseBetterShift(existing, result.shift));
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function mergeShiftCandidates(...groups: ParsedCalendarShift[][]): ParsedCalendarShift[] {
  const byDate = new Map<string, ParsedCalendarShift>();

  for (const group of groups) {
    for (const shift of consolidateShiftCandidates(group)) {
      const existing = byDate.get(shift.date);
      if (!existing) {
        byDate.set(shift.date, shift);
        continue;
      }

      const merged: ParsedCalendarShift = {
        ...existing,
        startTime: existing.startTime === '??:??' && shift.startTime !== '??:??' ? shift.startTime : existing.startTime,
        endTime: existing.endTime === '??:??' && shift.endTime !== '??:??' ? shift.endTime : existing.endTime,
        confidence: Math.max(existing.confidence, shift.confidence),
        isValid: existing.isValid || shift.isValid,
        rawText: `${existing.rawText} || ${shift.rawText}`.trim(),
      };

      byDate.set(shift.date, chooseBetterShift(chooseBetterShift(existing, shift), merged));
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function runOcrPass(
  worker: Tesseract.Worker,
  canvas: HTMLCanvasElement,
  source: string,
  offsetX = 0,
  offsetY = 0,
): Promise<OcrPassResult> {
  const blob = await canvasToBlob(canvas);
  const result = await worker.recognize(blob);
  const data = result.data as {
    text?: string;
    words?: Array<{
      text?: string;
      confidence?: number;
      bbox?: { x0: number; y0: number; x1: number; y1: number };
    }>;
  };

  const words = Array.isArray(data.words) ? data.words : [];
  const blocks: TextBlock[] = [];

  for (const word of words) {
    const text = sanitizeText(word.text ?? '');
    const bbox = word.bbox;
    const confidence = Number(word.confidence ?? 0);

    if (!text || !bbox || confidence < 20) {
      continue;
    }

    blocks.push({
      text,
      x: bbox.x0 + offsetX,
      y: bbox.y0 + offsetY,
      width: bbox.x1 - bbox.x0,
      height: bbox.y1 - bbox.y0,
      confidence,
      source,
    });
  }

  return {
    blocks,
    rawText: data.text ?? '',
  };
}

function dedupeBlocks(blocks: TextBlock[]): TextBlock[] {
  const merged: TextBlock[] = [];

  for (const block of blocks.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const duplicate = merged.find((candidate) => {
      const sameText = candidate.text.toLowerCase() === block.text.toLowerCase();
      const closeX = Math.abs(candidate.x - block.x) <= 18;
      const closeY = Math.abs(candidate.y - block.y) <= 18;
      return sameText && closeX && closeY;
    });

    if (!duplicate) {
      merged.push(block);
      continue;
    }

    if (block.confidence > duplicate.confidence) {
      duplicate.text = block.text;
      duplicate.x = block.x;
      duplicate.y = block.y;
      duplicate.width = block.width;
      duplicate.height = block.height;
      duplicate.confidence = block.confidence;
      duplicate.source = block.source;
    }
  }

  return merged;
}

function isLikelyCalendarLine(line: string): boolean {
  const cleaned = sanitizeText(line);
  if (!cleaned) {
    return false;
  }

  if (WEEKDAY_HEADER_RE.test(cleaned)) {
    return false;
  }

  return (
    /\d/.test(cleaned) ||
    /libre|td|jt/i.test(cleaned) ||
    cleaned.includes(':')
  );
}

function parseSingleTextPass(rawText: string, month: number, year: number): ParsedCalendarShift[] {
  const results: ParsedCalendarShift[] = [];
  const lines = rawText
    .split('\n')
    .map((line) => sanitizeText(line))
    .filter((line) => isLikelyCalendarLine(line));

  const dayRows: Array<{ lineIndex: number; days: number[] }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes(':')) {
      continue;
    }

    const tokens = line.split(/\s+/);
    const dayNumbers = tokens
      .map((token) => Number.parseInt(token, 10))
      .filter((value) => !Number.isNaN(value) && value >= 1 && value <= 31);

    if (dayNumbers.length >= 1 && dayNumbers.length >= Math.ceil(tokens.length * 0.5)) {
      dayRows.push({ lineIndex: index, days: dayNumbers });
    }
  }

  const uniqueRows = dayRows.filter((row, index) => {
    const previous = dayRows[index - 1];
    return !previous || previous.lineIndex !== row.lineIndex;
  });

  for (let rowIndex = 0; rowIndex < uniqueRows.length; rowIndex += 1) {
    const current = uniqueRows[rowIndex];
    const nextIndex = uniqueRows[rowIndex + 1]?.lineIndex ?? lines.length;
    const chunk = lines.slice(current.lineIndex + 1, nextIndex);

    if (current.days.length === 1) {
      const day = current.days[0];
      const allTimes = chunk.flatMap((line) => extractTimesFromLine(line));

      if (allTimes.length >= 2) {
        results.push({
          date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          startTime: allTimes[0],
          endTime: allTimes[1],
          isValid: true,
          confidence: 0.72,
          rawText: `${allTimes[0]} - ${allTimes[1]}`,
        });
      }
      continue;
    }

    const timeLines = chunk.filter((line) => extractTimesFromLine(line).length > 0);
    const startColumns = timeLines[0] ? splitIntoColumns(timeLines[0]) : [];
    const endColumns = timeLines[1] ? splitIntoColumns(timeLines[1]) : [];

    let alignedStartColumns = [...startColumns];
    let alignedEndColumns = [...endColumns];

    if (alignedEndColumns.length > alignedStartColumns.length && alignedStartColumns.length > 0) {
      const padding = new Array(alignedEndColumns.length - alignedStartColumns.length).fill('');
      alignedStartColumns = [...padding, ...alignedStartColumns];
    }

    if (alignedStartColumns.length > alignedEndColumns.length && alignedEndColumns.length > 0) {
      const padding = new Array(alignedStartColumns.length - alignedEndColumns.length).fill('');
      alignedEndColumns = [...padding, ...alignedEndColumns];
    }

    for (let dayIndex = 0; dayIndex < current.days.length; dayIndex += 1) {
      const day = current.days[dayIndex];
      const startToken = alignedStartColumns[dayIndex] ?? '';
      const endToken = alignedEndColumns[dayIndex] ?? '';
      const startTime = normalizeTime(startToken);
      const endTime = normalizeTime(endToken);
      const markerSource = `${startToken} ${endToken}`.trim();

      if (/libre|td/i.test(markerSource)) {
        continue;
      }

      if (!startTime && !endTime) {
        continue;
      }

      results.push({
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        startTime: startTime ?? '??:??',
        endTime: endTime ?? '??:??',
        isValid: Boolean(startTime && endTime),
        confidence: startTime && endTime ? 0.76 : 0.45,
        rawText: `${startToken || '??'} - ${endToken || '??'}`,
      });
    }
  }

  return consolidateShiftCandidates(results);
}

export function detectMonthYear(rawText: string, blocks: TextBlock[]): { month: number; year: number } {
  const now = new Date();
  let detectedMonth = now.getMonth();
  let detectedYear = now.getFullYear();

  const combined = `${rawText} ${blocks.map((block) => block.text).join(' ')}`.toLowerCase();
  for (const [name, index] of Object.entries(MONTHS_ES)) {
    if (combined.includes(name)) {
      detectedMonth = index;
      break;
    }
  }

  const yearMatch = combined.match(/\b(202[4-9]|203[0-9])\b/);
  if (yearMatch) {
    detectedYear = Number.parseInt(yearMatch[1], 10);
  }

  return { month: detectedMonth, year: detectedYear };
}

export async function extractTextBlocksWithPositions(imageFile: File): Promise<{ blocks: TextBlock[]; rawText: string }> {
  const worker = await createWorker('spa+eng');

  try {
    const baseCanvas = await loadImageToCanvas(imageFile);
    const passes = await Promise.all([
      runOcrPass(worker, baseCanvas, 'full-original'),
      runOcrPass(worker, applyContrastVariant(baseCanvas), 'full-contrast'),
      runOcrPass(worker, applyColorLiftVariant(baseCanvas), 'full-color-lift'),
    ]);

    return {
      blocks: dedupeBlocks(passes.flatMap((pass) => pass.blocks)),
      rawText: passes.map((pass) => pass.rawText).join('\n'),
    };
  } finally {
    await worker.terminate();
  }
}

export function parseShiftsFromText(rawText: string, month: number, year: number): ParsedCalendarShift[] {
  return parseSingleTextPass(rawText, month, year);
}

export function processCalendarData(
  blocks: TextBlock[],
  rawText: string,
  month: number,
  year: number,
  supplementaryText?: string,
): ParsedCalendarShift[] {
  const grid = parseShiftsFromBlocks(blocks, month, year);
  const primary = parseSingleTextPass(rawText, month, year);
  const secondary = supplementaryText ? parseSingleTextPass(supplementaryText, month, year) : [];
  return mergeShiftCandidates(grid, primary, secondary);
}

export async function parseCalendarImageWithTesseract(imageFile: File): Promise<ParsedCalendarShift[]> {
  const worker = await createWorker('spa+eng');

  try {
    const baseCanvas = await loadImageToCanvas(imageFile);
    const contrastCanvas = applyContrastVariant(baseCanvas);
    const colorLiftCanvas = applyColorLiftVariant(baseCanvas);
    const fullPasses = await Promise.all([
      runOcrPass(worker, baseCanvas, 'full-original'),
      runOcrPass(worker, contrastCanvas, 'full-contrast'),
      runOcrPass(worker, colorLiftCanvas, 'full-color-lift'),
    ]);

    const blocks = dedupeBlocks(fullPasses.flatMap((pass) => pass.blocks));
    const rawText = fullPasses.map((pass) => pass.rawText).join('\n');
    const { month, year } = detectMonthYear(rawText, blocks);
    const imageWidth = baseCanvas.width;
    const imageHeight = baseCanvas.height;

    const regionalSlices = buildRegionalSlices(baseCanvas);
    const regionalPasses: OcrPassResult[] = [];

    for (const slice of regionalSlices) {
      regionalPasses.push(await runOcrPass(worker, slice.canvas, slice.name, slice.offsetX, slice.offsetY));
    }

    const allBlocks = dedupeBlocks([...blocks, ...regionalPasses.flatMap((pass) => pass.blocks)]);
    const supplementaryText = regionalPasses.map((pass) => pass.rawText).join('\n');
    const gridResult = parseShiftsFromBlocks(allBlocks, month, year, imageWidth, imageHeight);
    const fullResult = parseSingleTextPass(rawText, month, year);
    const regionalResult = parseSingleTextPass(supplementaryText, month, year);
    const approxCells = buildApproxCalendarCells(imageWidth, imageHeight, month, year);
    const cellResults = await ocrCalendarCells(worker, contrastCanvas, baseCanvas, approxCells, month, year);
    const cellShiftResults = cellResults
      .filter((result) => result.shift !== null)
      .map((result) => result.shift as ParsedCalendarShift);
    const merged = inferMissingShiftTimes(applyCellOcrCorrections(
      mergeShiftCandidates(gridResult, fullResult, regionalResult, cellShiftResults),
      cellResults,
    ));

    console.log('[OCR] Month/year:', { month, year });
    console.log('[OCR] Grid result:', gridResult);
    console.log('[OCR] Full result:', fullResult);
    console.log('[OCR] Regional result:', regionalResult);
    console.log('[OCR] Cell result:', cellResults);
    console.log('[OCR] Merged result:', merged);

    return merged;
  } finally {
    await worker.terminate();
  }
}
