import { useMemo } from 'react';
import { Shift, ShiftOrigin, WeeklyStats } from '../../lib/types';
import { aggregateWeeklyStats, filterShiftsByOrigin } from '../../lib/shifts';

interface StatsBarProps {
  currentMonthShifts: Shift[];
  daysInMonth: number;
  currentYearShifts: Shift[];
  daysInYear: number;
}

function buildOriginStats(shifts: Shift[], totalDays: number, origin: ShiftOrigin) {
  return aggregateWeeklyStats(filterShiftsByOrigin(shifts, origin), totalDays);
}

type StatsCell =
  | { kind: 'section'; label: string }
  | { kind: 'token'; label: string; value: string; className?: string };

function TotalToken({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span className={`totals-token ${className ?? ''}`.trim()}>
      <strong>{label}</strong> {value}
    </span>
  );
}

function SectionToken({ label }: { label: string }) {
  return <span className="totals-section-label">{label}</span>;
}

function formatTokenValue(hours: number, days: number): string {
  const normalizedDays = hours === 0 ? 0 : days;
  return `${hours.toFixed(1)}h / ${normalizedDays}d`;
}

function buildSummaryCells(monthStats: WeeklyStats, yearStats: WeeklyStats): StatsCell[] {
  return [
    { kind: 'section', label: 'Tot. M.' },
    { kind: 'token', label: 'Mes', value: formatTokenValue(monthStats.totalWorkedHours, monthStats.totalWorkedDays) },
    { kind: 'token', label: 'Regular', value: formatTokenValue(monthStats.hoursByType.Regular, monthStats.daysByType.Regular), className: 'type-regular' },
    { kind: 'token', label: 'JT', value: formatTokenValue(monthStats.hoursByType.JT, monthStats.daysByType.JT), className: 'type-jt' },
    { kind: 'token', label: 'Libres', value: formatTokenValue(monthStats.hoursByType.Libre, monthStats.daysByType.Libre), className: 'type-libre' },
    { kind: 'token', label: 'Extras', value: formatTokenValue(monthStats.hoursByType.Extras, monthStats.daysByType.Extras), className: 'type-extras' },
    { kind: 'section', label: 'Tot. A.' },
    { kind: 'token', label: 'Año', value: formatTokenValue(yearStats.totalWorkedHours, yearStats.totalWorkedDays) },
    { kind: 'token', label: 'Regular', value: formatTokenValue(yearStats.hoursByType.Regular, yearStats.daysByType.Regular), className: 'type-regular' },
    { kind: 'token', label: 'JT', value: formatTokenValue(yearStats.hoursByType.JT, yearStats.daysByType.JT), className: 'type-jt' },
    { kind: 'token', label: 'Libres', value: formatTokenValue(yearStats.hoursByType.Libre, yearStats.daysByType.Libre), className: 'type-libre' },
    { kind: 'token', label: 'Extras', value: formatTokenValue(yearStats.hoursByType.Extras, yearStats.daysByType.Extras), className: 'type-extras' },
  ];
}

function measureText(text: string, font: string): number {
  if (typeof document === 'undefined') {
    return text.length * 8;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return text.length * 8;
  }

  context.font = font;
  return context.measureText(text).width;
}

function buildGridTemplate(rows: StatsCell[][]): string {
  const rootFontSize = typeof window === 'undefined'
    ? 16
    : Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize || '16');
  const tokenFont = `700 ${0.62 * rootFontSize}px Inter, system-ui, sans-serif`;
  const sectionFont = `800 ${0.58 * rootFontSize}px Inter, system-ui, sans-serif`;
  const minPadding = 10;
  const minColumnWidth = 56;

  const widths = rows[0].map((_, index) => {
    const widest = Math.max(...rows.map((row) => {
      const cell = row[index];
      if (cell.kind === 'section') {
        return measureText(cell.label, sectionFont);
      }

      return measureText(`${cell.label} ${cell.value}`, tokenFont);
    }));

    return Math.max(Math.ceil(widest + minPadding), minColumnWidth);
  });

  return widths.map((width) => `${width}px`).join(' ');
}

function SummaryLine({
  title,
  cells,
  gridTemplateColumns,
}: {
  title: string;
  cells: StatsCell[];
  gridTemplateColumns: string;
}) {
  return (
    <div className="totals-line">
      <div className="totals-line-title">{title}</div>
      <div className="totals-line-values" style={{ gridTemplateColumns }}>
        {cells.map((cell, index) =>
          cell.kind === 'section'
            ? <SectionToken key={`${title}-section-${index}`} label={cell.label} />
            : <TotalToken key={`${title}-token-${index}`} label={cell.label} value={cell.value} className={cell.className} />
        )}
      </div>
    </div>
  );
}

export const StatsBar = ({ currentMonthShifts, daysInMonth, currentYearShifts, daysInYear }: StatsBarProps) => {
  const ownMonthStats = useMemo(() => buildOriginStats(currentMonthShifts, daysInMonth, 'MAN'), [currentMonthShifts, daysInMonth]);
  const ownYearStats = useMemo(() => buildOriginStats(currentYearShifts, daysInYear, 'MAN'), [currentYearShifts, daysInYear]);
  const companyMonthStats = useMemo(() => buildOriginStats(currentMonthShifts, daysInMonth, 'PDF'), [currentMonthShifts, daysInMonth]);
  const companyYearStats = useMemo(() => buildOriginStats(currentYearShifts, daysInYear, 'PDF'), [currentYearShifts, daysInYear]);
  const ownCells = useMemo(() => buildSummaryCells(ownMonthStats, ownYearStats), [ownMonthStats, ownYearStats]);
  const companyCells = useMemo(() => buildSummaryCells(companyMonthStats, companyYearStats), [companyMonthStats, companyYearStats]);
  const gridTemplateColumns = useMemo(
    () => buildGridTemplate([ownCells, companyCells]),
    [ownCells, companyCells],
  );

  return (
    <div className="totals-ribbon">
      <SummaryLine title="Propios" cells={ownCells} gridTemplateColumns={gridTemplateColumns} />
      <SummaryLine title="Empresa" cells={companyCells} gridTemplateColumns={gridTemplateColumns} />
    </div>
  );
};
