# Feature Spec: Shift Image Calendar Ingestion

## 1. Objective
Enable users to import shifts by uploading an image of a monthly calendar. The system will use OCR and heuristics to detect dates, times, and month headers.

## 2. Requirements
- **OCR Engine**: Tesseract.js (Frontend only).
- **Header Detection**: Identify the Month (Spanish/English) and Year (fall back to current if missing).
- **Grid Reconstruction**: Map text blocks to specific calendar days (1-31).
- **Time Parsing**: Detect patterns like `HH:MM`, `HH.MM`, `HH-MM` or consecutive time lines.
- **Exclusion Logic**: Ignore non-shift markers like "Libre" or "TD".
- **Validation**: Identify ambiguous blocks (e.g., misrecognized characters like "1T:00").
- **Preview UI**: High-tech dashboard with image on left and editable table on right.

## 3. Data Flow
1. File input -> `Tesseract.recognize` -> Raw blocks with coordinates.
2. `reconstructCalendarStructure` -> Group blocks into virtual grid cells.
3. `parseCalendarShifts` -> Convert grid data into proposed `Shift` objects (temp state).
4. User Review -> Edit/Validate in the Preview Modal.
5. Confirmation -> Push to `shifts` state and `localStorage`.

## 4. Edge Cases
- Low quality/dark images (OCR noise).
- Misaligned columns (Grid detection failure).
- Overnight shifts detected by end < start logic.
- Duplicate detection before final import.
