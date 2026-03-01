/**
 * Forge Shift Parser: Backend service that extracts shift data from calendar images
 * using Forge API with gemini-2.5-flash vision model.
 * 
 * This service encapsulates the Forge API call without exposing the token.
 * The token is managed securely on the backend.
 */

export interface ExtractedShift {
  day: number;
  month: number;
  year: number;
  shiftType: string;
  startTime?: string | null;
  endTime?: string | null;
  color: string;
  notes?: string;
}

/**
 * Send image to backend service for processing with Forge API
 */
export async function parseCalendarWithForge(
  file: File,
  month: number,
  year: number
): Promise<ExtractedShift[]> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('month', month.toString());
  formData.append('year', year.toString());

  try {
    const response = await fetch('/api/shifts/extract-forge', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to extract shifts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.shifts || [];
  } catch (error) {
    console.error('[Forge Parser] Error:', error);
    throw error;
  }
}

/**
 * Check if Forge service is available
 */
export async function checkForgeAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/shifts/health');
    return response.ok;
  } catch {
    return false;
  }
}
