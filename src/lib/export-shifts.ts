/**
 * Export utilities for shifts
 * Handles Excel and JSON export functionality
 */

import { ExtractedShift } from './forge-shift-parser';

/**
 * Export shifts to Excel file
 */
export async function exportShiftsToExcel(
  shifts: ExtractedShift[],
  month: number,
  year: number
): Promise<void> {
  try {
    const response = await fetch('/api/shifts/export-excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shifts, month, year }),
    });

    if (!response.ok) {
      throw new Error(`Failed to export Excel: ${response.statusText}`);
    }

    // Get filename from response header
    const contentDisposition = response.headers.get('content-disposition');
    let filename = `turnos-${year}-${String(month).padStart(2, '0')}.xlsx`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[Export] Excel error:', error);
    throw error;
  }
}

/**
 * Export shifts to JSON file
 */
export async function exportShiftsToJSON(shifts: ExtractedShift[]): Promise<void> {
  try {
    const response = await fetch('/api/shifts/export-json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shifts }),
    });

    if (!response.ok) {
      throw new Error(`Failed to export JSON: ${response.statusText}`);
    }

    // Get filename from response header
    const contentDisposition = response.headers.get('content-disposition');
    let filename = 'turnos.json';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[Export] JSON error:', error);
    throw error;
  }
}
