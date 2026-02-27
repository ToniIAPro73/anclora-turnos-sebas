# Workspace Governance Rules

## Principles
1. **Feature-Driven Structure**: All code and documentation related to a specific feature must reside within its designated feature directory.
2. **SDD as Contract**: The System Design & Definition (SDD) files are the absolute source of truth. No code implementation should deviate from the approved spec.
3. **Versioned Changes**: All documentation and code changes must be versioned. Avoid overwriting critical specs without updating the version number or providing a migration path if necessary.

## Core Rules
- **No Scope Creep**: NEVER implement features or logic not explicitly defined in the `SPEC`. If a new requirement arises, update the `SPEC` first.
- **Single Source of Truth**: Do not duplicate business logic definitions. Reference the `SPEC` or centralized `core` modules.
- **Separation of Concerns**: 
  - Prefer pure logic and business rules in `src/lib/`.
  - Keep UI components in `src/components/`, focused primarily on presentation and user interaction.
- **Tooling First**: Always check `.agent/rules/` and `.agent/skills/` before starting a task to ensure compliance with established workflows.
