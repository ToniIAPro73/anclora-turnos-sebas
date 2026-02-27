# Test Plan: Shift Dashboard v1

## Objective
Validate that the Shift Dashboard implementation strictly adheres to the functional specifications (SPEC) and architectural rules (RULES).

## Scope
- **Business Logic**: Categorization, duration calculation (including overnight), statistics aggregation.
- **UI Interaction**: Week navigation, CRUD operations (Add, Edit, Delete), Widget responsiveness.
- **Architecture**: Single Source of Truth (SSOT), derived state calculation, persistence in LocalStorage.

## Test Scenarios
### 1. Categorization Logic
- Input 09:00 -> Expected: 'Mañana'
- Input 15:00 -> Expected: 'Tarde'
- Input 23:00 -> Expected: 'Noche'

### 2. Time Math
- Start 22:00, End 06:00 -> Expected Duration: 8 hours.
- Verify duration is reflected in Weekly Hours widget.

### 3. Dynamic Updates
- Delete a shift in the current week -> Expected: Weekly Hours widget updates immediately.
- Add a shift in the future -> Expected: Next Shift widget updates if applicable.

### 4. Persistence
- Reload application -> Expected: Shifts persist across sessions.

### 5. RULES Compliance
- Inspect `src/lib/storage.ts`: Ensure only raw `Shift` data is saved, not `ShiftWithDerived`.
