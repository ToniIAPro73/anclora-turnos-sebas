/**
 * Export utilities for shifts
 * Handles Excel and JSON export functionality
 */

/**
 * Export shifts to Excel format with calendar-style table
 */
export async function exportToExcel(shifts, month, year) {
  try {
    // Dynamic import of ExcelJS
    const ExcelJS = (await import('exceljs')).default;
    
    const workbook = new ExcelJS.Workbook();
    const monthName = new Date(year, month - 1).toLocaleString("es-ES", { month: "long" });
    const worksheetName = `Turnos ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
    const worksheet = workbook.addWorksheet(worksheetName);

    // Configure column widths
    worksheet.columns = [
      { header: "Lunes", width: 20 },
      { header: "Martes", width: 20 },
      { header: "Miércoles", width: 20 },
      { header: "Jueves", width: 20 },
      { header: "Viernes", width: 20 },
      { header: "Sábado", width: 20 },
      { header: "Domingo", width: 20 },
    ];

    // Header style
    const headerStyle = {
      font: { bold: true, size: 12, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // Apply header styles
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Get first day of month and days in month
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    // Adjust first day (0 = Sunday, convert to Monday-first)
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    // Get previous month days
    const prevMonthDays = adjustedFirstDay > 0 ? adjustedFirstDay : 0;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    const prevMonthStartDay = daysInPrevMonth - prevMonthDays + 1;

    // Create calendar rows
    let currentRow = 2;
    let currentCol = 1;
    let dayCounter = prevMonthStartDay;
    let isPrevMonth = true;
    let isCurrentMonth = false;
    let isNextMonth = false;

    // Total cells to fill
    const totalCells = 7 * Math.ceil((prevMonthDays + daysInMonth) / 7);

    for (let i = 0; i < totalCells; i++) {
      // Determine month context
      if (i < prevMonthDays) {
        isCurrentMonth = false;
        isPrevMonth = true;
        isNextMonth = false;
        dayCounter = prevMonthStartDay + i;
      } else if (i < prevMonthDays + daysInMonth) {
        isCurrentMonth = true;
        isPrevMonth = false;
        isNextMonth = false;
        dayCounter = i - prevMonthDays + 1;
      } else {
        isCurrentMonth = false;
        isPrevMonth = false;
        isNextMonth = true;
        dayCounter = i - prevMonthDays - daysInMonth + 1;
      }

      const cell = worksheet.getCell(currentRow, currentCol);

      // Get shifts for this day
      let dayShifts = [];
      if (isPrevMonth) {
        dayShifts = shifts.filter((s) => s.day === dayCounter && s.month === prevMonth && s.year === prevYear);
      } else if (isCurrentMonth) {
        dayShifts = shifts.filter((s) => s.day === dayCounter && s.month === month && s.year === year);
      } else if (isNextMonth) {
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        dayShifts = shifts.filter((s) => s.day === dayCounter && s.month === nextMonth && s.year === nextYear);
      }

      // Build cell content
      let cellContent = `${dayCounter}`;

      if (dayShifts.length > 0) {
        const shift = dayShifts[0];
        cellContent += `\n${shift.shiftType}`;

        if (shift.startTime && shift.endTime) {
          cellContent += `\n${shift.startTime}-${shift.endTime}`;
        } else if (shift.startTime) {
          cellContent += `\n${shift.startTime}`;
        } else if (shift.endTime) {
          cellContent += `\n${shift.endTime}`;
        }

        if (shift.notes && shift.notes.trim()) {
          cellContent += `\n${shift.notes}`;
        }
      }

      cell.value = cellContent;

      // Cell style
      const cellStyle = {
        alignment: { horizontal: "left", vertical: "top", wrapText: true },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
        font: { size: 10 },
      };

      // Background color
      let bgColor = "FFFFFFFF";

      if (isPrevMonth || isNextMonth) {
        bgColor = "FFF0F0F0";
      } else if (dayShifts.length > 0) {
        const firstShift = dayShifts[0];

        if (firstShift.shiftType.toLowerCase().includes("libre")) {
          bgColor = "FFFFE5E5";
        } else if (firstShift.color === "blue") {
          bgColor = "FFE5F0FF";
        } else if (firstShift.color === "red") {
          bgColor = "FFFFE5E5";
        } else if (firstShift.color === "gray") {
          bgColor = "FFE8E8E8";
        } else if (firstShift.color === "green") {
          bgColor = "FFE5FFE5";
        }
      }

      cellStyle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.style = cellStyle;

      worksheet.getRow(currentRow).height = 70;

      currentCol++;

      if (currentCol > 7) {
        currentCol = 1;
        currentRow++;
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('[Export] Excel error:', error);
    throw error;
  }
}

/**
 * Export shifts to JSON format
 */
export function exportToJSON(shifts) {
  return JSON.stringify(shifts, null, 2);
}
