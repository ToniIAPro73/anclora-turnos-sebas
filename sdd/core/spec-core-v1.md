# SDD Core Framework v1

## Document Standards
All SDD documents must follow these naming and versioning standards:

- **Naming**: `[type]-[name]-spec-[version].md` or `[type]-core-[version].md`.
- **Versioning**: Start with `v1` (or `v0` for drafts). Increment for significant logic changes.

## Feature Lifecycle in SDD
1. **Spec Generation**: Use `sdd/.templates/spec-feature-template.md`.
2. **Gate Final**: When a feature is delivered, a `Gate Final` report must be stored in the feature's directory (`sdd/features/[name]/gate-final-[version].md`).

## Core Definitions
- **Product Vision**: Stored in `sdd/core/product-spec-v0.md`.
- **Global Types**: Shared data models that cross feature boundaries.
- **Common Logic**: Standardized algorithms (e.g., date-time handling) to be implemented in `src/lib/`.
