# Feature Delivery Baseline: Shift Dashboard

## Specific Instructions for Shift Dashboard
1. **Shift Entity Priority**: Ensure the `Shift` interface matches exactly what's defined in `shift-dashboard-spec-v1.md`.
2. **Category Logic**: Implement the auto-categorization logic in `src/lib/` to ensure it can be unit tested without React.
3. **Overnight Math**: Pay special attention to the duration calculation when a shift crosses midnight (22:00 to 06:00).
4. **Widget States**: Ensure widgets handle the "No pending shifts" or "No shifts in week" states gracefully with premium empty state designs.

## Success Metric
The "Weekly Hours" widget must exactly match the sum of durations of all shifts displayed in the current week view.
