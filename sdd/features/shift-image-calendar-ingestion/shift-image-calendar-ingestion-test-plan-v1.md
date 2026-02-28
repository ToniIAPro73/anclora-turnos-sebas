# Test Plan: Shift Image Calendar Ingestion

## 1. OCR Accuracy
- Test with standard digital calendar screenshots.
- Test with physical photos of paper calendars (lighting variations).
- Verify character correction (e.g., "1T:00" -> "17:00" attempt or warning).

## 2. Parsing Heuristics
- **Month Logic**: Detect "Marzo" -> Month 2 (0-indexed).
- **Day Logic**: Verify number "23" is correctly associated with the time block below it.
- **Overnight**: Start 22:00, End 02:00 -> Duration 4h.

## 3. UI/UX Flow
- Verify "Cargando..." state during OCR processing.
- Verify edit functionality in the Preview Table.
- Verify image preview zoom/pan if possible.

## 4. Integration
- Confirm that imported shifts appear in the main grid and widgets immediately.
- Confirm persistence after page reload.
