# Feature Delivery Baseline

## Delivery Workflow
1. **SPEC**: Define the feature requirements and technical design in an SDD file.
2. **PLAN**: Create an implementation plan (typically `implementation_plan.md`) describing the files to be modified and the verification steps.
3. **IMPLEMENT**: Write the code following the plan and the workspace rules.
4. **QA**: Run manual and automated tests. Generate a `QA Report` based on the template.
5. **GATE FINAL**: Submit the work for final approval using the `Gate Final` template.

## Checkpoints
- Spec Approval
- Plan Approval
- QA Report Completion
- Gate Final Signature

## Criteria for "Done"
- Code meets all requirements in the SPEC.
- All edge cases documented in SPEC are handled.
- UI follows Google Antigravity global principles (consistency, accessibility).
- QA Report shows 100% success on listed scenarios.
- No linting or build errors.
