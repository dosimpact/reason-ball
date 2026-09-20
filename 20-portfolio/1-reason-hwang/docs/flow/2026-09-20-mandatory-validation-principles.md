# Mandatory Validation Principles

- Date: 2026-09-20
- Domain: `shared`
- Decisions: `VAL-API-001`, `VAL-VIEW-001`, `VAL-BROWSER-001`.
- Context: User requires API E2E following the repository Bruno skill, Storybook testing for pure View changes, and MCP browser verification for business logic.
- Change: Added [validation procedures](../validation/README.md) and linked them from [AGENTS.md](../../AGENTS.md) and the [document map](../README.md). Bruno skill references use relative paths.
- Rationale: Verify observable behavior at the appropriate level; apply overlapping checks together and retain execution evidence.
- Affected stock: [Shared test design](../stock/shared/test-design.md), Mandatory change-based validation.
- Validation: Relative-link checks for changed documents, policy coverage review, and scoped diff review. Runtime API/UI tests are not applicable to this documentation-only change.
- Follow-up: Apply the required methods to subsequent implementation changes; unavailable tools or environments remain incomplete validation.
