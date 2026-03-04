import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
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
  return <span className="totals-section-label totals-section-token">{label}</span>;
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

function measureText(text: string, font: string, letterSpacingPx: number = 0): number {
  if (typeof document === 'undefined') {
    return (text.length * 8) + Math.max(0, text.length - 1) * letterSpacingPx;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return (text.length * 8) + Math.max(0, text.length - 1) * letterSpacingPx;
  }

  context.font = font;
  return context.measureText(text).width + (Math.max(0, text.length - 1) * letterSpacingPx);
}

function getCellContentWidth(cell: StatsCell, sectionFont: string, tokenFont: string, sectionLetterSpacing: number, tokenLetterSpacing: number): number {
  if (cell.kind === 'section') {
    return measureText(cell.label, sectionFont, sectionLetterSpacing);
  }

  return measureText(`${cell.label} ${cell.value}`, tokenFont, tokenLetterSpacing);
}

function distributeWidth(baseWidths: number[], targetWidth: number): number[] {
  const currentWidth = baseWidths.reduce((sum, width) => sum + width, 0);
  if (currentWidth >= targetWidth) {
    return baseWidths.map((width) => Math.ceil(width));
  }

  const extraWidth = targetWidth - currentWidth;
  const totalBaseWidth = baseWidths.reduce((sum, width) => sum + width, 0);

  if (totalBaseWidth <= 0) {
    const evenExtra = Math.floor(extraWidth / baseWidths.length);
    let remainder = extraWidth - (evenExtra * baseWidths.length);

    return baseWidths.map((width) => {
      const nextWidth = width + evenExtra + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      return Math.ceil(nextWidth);
    });
  }

  const rawWidths = baseWidths.map((width) => width + ((width / totalBaseWidth) * extraWidth));
  const roundedWidths = rawWidths.map((width) => Math.floor(width));
  let remainder = targetWidth - roundedWidths.reduce((sum, width) => sum + width, 0);

  const remainderOrder = rawWidths
    .map((width, index) => ({ index, fraction: width - Math.floor(width) }))
    .sort((left, right) => right.fraction - left.fraction);

  for (let index = 0; index < remainder && index < remainderOrder.length; index += 1) {
    roundedWidths[remainderOrder[index].index] += 1;
  }

  return roundedWidths;
}

function buildSharedColumnWidths(
  titles: string[],
  rows: StatsCell[][],
  availableLineContentWidth: number | null,
): { titleColumnWidth: string; gridTemplateColumns: string } {
  const rootFontSize = typeof window === 'undefined'
    ? 16
    : Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize || '16');
  const tokenFont = `700 ${0.62 * rootFontSize}px Inter, system-ui, sans-serif`;
  const sectionFont = `800 ${0.58 * rootFontSize}px Inter, system-ui, sans-serif`;
  const titleFont = `800 ${0.72 * rootFontSize}px Inter, system-ui, sans-serif`;
  const tokenLetterSpacing = 0.05 * (0.58 * rootFontSize);
  const sectionLetterSpacing = 0.05 * (0.58 * rootFontSize);
  const sidePadding = 10;

  const titleContentWidth = Math.max(...titles.map((title) => measureText(title, titleFont)));
  const columnContentWidths = rows[0].map((_, index) =>
    Math.max(...rows.map((row) =>
      getCellContentWidth(row[index], sectionFont, tokenFont, sectionLetterSpacing, tokenLetterSpacing),
    )),
  );

  const sharedFixedWidth = Math.ceil(
    Math.max(
      titleContentWidth + 5,
      columnContentWidths[0] + sidePadding,
      columnContentWidths[6] + sidePadding,
    ),
  );

  const contentWidths = columnContentWidths.map((width, index) => {
    if (index === 0 || index === 6) return sharedFixedWidth;
    return Math.ceil(width + sidePadding);
  });

  const monthVariableWidths = contentWidths.slice(1, 6);
  const yearVariableWidths = contentWidths.slice(7, 12);
  const monthMinWidth = sharedFixedWidth + monthVariableWidths.reduce((sum, width) => sum + width, 0);
  const yearMinWidth = sharedFixedWidth + yearVariableWidths.reduce((sum, width) => sum + width, 0);
  const minHalfWidth = Math.max(monthMinWidth, yearMinWidth);
  const availableValuesWidth = availableLineContentWidth === null
    ? null
    : Math.max(0, availableLineContentWidth - sharedFixedWidth);
  const targetHalfWidth = availableValuesWidth && availableValuesWidth >= (minHalfWidth * 2)
    ? Math.floor(availableValuesWidth / 2)
    : minHalfWidth;

  const resolvedMonthVariableWidths = distributeWidth(monthVariableWidths, targetHalfWidth - sharedFixedWidth);
  const resolvedYearVariableWidths = distributeWidth(yearVariableWidths, targetHalfWidth - sharedFixedWidth);

  return {
    titleColumnWidth: `${sharedFixedWidth}px`,
    gridTemplateColumns: [
      sharedFixedWidth,
      ...resolvedMonthVariableWidths,
      sharedFixedWidth,
      ...resolvedYearVariableWidths,
    ].map((width) => `${width}px`).join(' '),
  };
}

function useAvailableValuesWidth(lineRef: RefObject<HTMLDivElement>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = lineRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateWidth = () => {
      const computedStyle = window.getComputedStyle(element);
      const paddingLeft = Number.parseFloat(computedStyle.paddingLeft || '0');
      const paddingRight = Number.parseFloat(computedStyle.paddingRight || '0');
      const contentWidth = element.clientWidth - paddingLeft - paddingRight;
      setWidth(Math.max(0, contentWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, [lineRef]);

  return width;
}

function SummaryLine({
  title,
  cells,
  gridTemplateColumns,
  titleColumnWidth,
  lineRef,
}: {
  title: string;
  cells: StatsCell[];
  gridTemplateColumns: string;
  titleColumnWidth: string;
  lineRef?: RefObject<HTMLDivElement>;
}) {
  return (
    <div ref={lineRef} className="totals-line" style={{ gridTemplateColumns: `${titleColumnWidth} minmax(0, 1fr)` }}>
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
  const firstLineRef = useRef<HTMLDivElement>(null);
  const ownMonthStats = useMemo(() => buildOriginStats(currentMonthShifts, daysInMonth, 'MAN'), [currentMonthShifts, daysInMonth]);
  const ownYearStats = useMemo(() => buildOriginStats(currentYearShifts, daysInYear, 'MAN'), [currentYearShifts, daysInYear]);
  const companyMonthStats = useMemo(() => buildOriginStats(currentMonthShifts, daysInMonth, 'PDF'), [currentMonthShifts, daysInMonth]);
  const companyYearStats = useMemo(() => buildOriginStats(currentYearShifts, daysInYear, 'PDF'), [currentYearShifts, daysInYear]);
  const ownCells = useMemo(() => buildSummaryCells(ownMonthStats, ownYearStats), [ownMonthStats, ownYearStats]);
  const companyCells = useMemo(() => buildSummaryCells(companyMonthStats, companyYearStats), [companyMonthStats, companyYearStats]);
  const availableValuesWidth = useAvailableValuesWidth(firstLineRef);
  const { titleColumnWidth, gridTemplateColumns } = useMemo(
    () => buildSharedColumnWidths(['Propios', 'Empresa'], [ownCells, companyCells], availableValuesWidth),
    [availableValuesWidth, ownCells, companyCells],
  );

  return (
    <div className="totals-ribbon">
      <SummaryLine title="Propios" cells={ownCells} gridTemplateColumns={gridTemplateColumns} titleColumnWidth={titleColumnWidth} lineRef={firstLineRef} />
      <SummaryLine title="Empresa" cells={companyCells} gridTemplateColumns={gridTemplateColumns} titleColumnWidth={titleColumnWidth} />
    </div>
  );
};
