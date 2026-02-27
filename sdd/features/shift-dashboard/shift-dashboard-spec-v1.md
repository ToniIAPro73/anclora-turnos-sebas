# SPEC: Shift Dashboard v1

## 1. Overview
A 7-day weekly dashboard to manage and visualize work shifts. Includes widgets for key metrics and a modal for adding/editing shifts.

## 2. Requirements
- Display a 7-day view starting on Monday.
- Navigation for previous and next weeks.
- Click a day to add a shift or click existing shift to edit.
- Widgets:
  - **Next Shift**: Closest upcoming shift (relative to now).
  - **Weekly Hours**: Total hours worked in the current week.
  - **Free Days**: Count of days with zero shifts in the week.

## 3. Technical Design

### Data Model: Shift (Entity)
```typescript
interface Shift {
  id: string; // UUID
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24h)
  endTime: string; // HH:mm (24h)
  location: string;
}
```

### Derived Fields (Computational)
- **Category**: Based on `startTime`:
  - `08:00 - 13:59`: Mañana
  - `14:00 - 21:59`: Tarde
  - `22:00 - 07:59`: Noche (Handles overnight transitions)
- **Duration**: Difference between `endTime` and `startTime`. Must handle overnight scenarios (e.g., 22:00 to 06:00 = 8 hours).

### UI Components (Antigravity Standards)
- **WeeklyGrid**: Horizontal list of 7 cards.
- **ShiftCard**: Colored based on category.
- **WidgetPanel**: Top or side section with the 3 widgets.
- **ShiftModal**: Form with validations.

## 4. Edge Cases
- **Overnight Shifts**: Validating that `endTime` < `startTime` implies crossing midnight.
- **Overlapping Shifts**: Warning or prevention of shifts on the same day/time (optional, check logic).
- **Empty Weeks**: Display clear empty states.

## 5. Acceptance Criteria
1. **Scenario 1 (Navigation)**: User clicks "Next", view updates to the following Monday-Sunday range.
2. **Scenario 2 (Overnight Duration)**: User adds shift 22:00 to 06:00. Weekly hours widget adds 8 hours correctly.
3. **Scenario 3 (Auto-Categorization)**: User adds shift at 14:30. Shift card is visually tagged as "Tarde".
4. **Scenario 4 (Next Shift Widget)**: If today is Tuesday 10:00 and there's a shift at 14:00, widget shows "Tarde @ 14:00".
5. **Scenario 5 (Validation)**: Modal prevents saving with empty startTime or invalid date.
