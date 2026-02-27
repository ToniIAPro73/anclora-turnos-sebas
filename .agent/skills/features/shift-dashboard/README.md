# Shift Dashboard Skills

This feature requires the following internal logic skills:

- **WeekRange**: Logic to calculate the range of a week (starting Monday, 7 days), and navigation functions (prev/next week).
- **TimeParsing**: Utilities to convert "HH:mm" strings to total minutes for calculation and comparison.
- **ShiftMath**: 
  - Categorization based on startTime (Mañana, Tarde, Noche).
  - Duration calculation, including overnight shifts (shifts ending after midnight).
- **Aggregations**:
  - `Next Shift`: Find the closest upcoming shift from current time.
  - `Weekly Hours`: Sum of durations within a given week.
  - `Free Days`: Count of days with zero shifts in a given week.
- **Storage**: Optional persistence logic for state using `localStorage`.
