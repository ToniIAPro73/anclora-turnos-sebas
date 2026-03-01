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

function TotalToken({
  label,
  value,
  suffix,
  className,
}: {
  label: string;
  value: string;
  suffix: string;
  className?: string;
}) {
  return (
    <span className={`totals-token ${className ?? ''}`.trim()}>
      <strong>{label}</strong> {value}{suffix}
    </span>
  );
}

function SummaryLine({
  title,
  monthStats,
  yearStats,
}: {
  title: string;
  monthStats: WeeklyStats;
  yearStats: WeeklyStats;
}) {
  return (
    <div className="totals-line">
      <div className="totals-line-title">{title}</div>
      <div className="totals-line-values">
        <TotalToken label="Mes" value={monthStats.weeklyHours.toFixed(1)} suffix="h" />
        <TotalToken label="Regular" value={monthStats.hoursByType.Regular.toFixed(1)} suffix="h" className="type-regular" />
        <TotalToken label="JT" value={monthStats.hoursByType.JT.toFixed(1)} suffix="h" className="type-jt" />
        <TotalToken label="Libres" value={String(monthStats.freeDays)} suffix="d" className="type-libre" />
        <TotalToken label="Extras" value={monthStats.hoursByType.Extras.toFixed(1)} suffix="h" className="type-extras" />
        <TotalToken label="Año" value={yearStats.weeklyHours.toFixed(1)} suffix="h" />
      </div>
    </div>
  );
}

export const StatsBar = ({ currentMonthShifts, daysInMonth, currentYearShifts, daysInYear }: StatsBarProps) => {
  const ownMonthStats = useMemo(() => buildOriginStats(currentMonthShifts, daysInMonth, 'IMG'), [currentMonthShifts, daysInMonth]);
  const ownYearStats = useMemo(() => buildOriginStats(currentYearShifts, daysInYear, 'IMG'), [currentYearShifts, daysInYear]);
  const companyMonthStats = useMemo(() => buildOriginStats(currentMonthShifts, daysInMonth, 'PDF'), [currentMonthShifts, daysInMonth]);
  const companyYearStats = useMemo(() => buildOriginStats(currentYearShifts, daysInYear, 'PDF'), [currentYearShifts, daysInYear]);

  return (
    <div className="totals-ribbon">
      <SummaryLine title="Propios" monthStats={ownMonthStats} yearStats={ownYearStats} />
      <SummaryLine title="Empresa" monthStats={companyMonthStats} yearStats={companyYearStats} />
    </div>
  );
};
