# Simplify Agent Entry Guidance

- Date: 2026-09-20
- Domain: `shared`
- Decision ID: `DOC-DISCOVERY-001`
- Context: User requested a shorter `AGENTS.md` after adopting progressive documentation discovery.
- Change: Reduced the entry guide to scope, documentation discovery, safety, implementation/validation, and completion. Removed duplicated package, command, port, architecture, and documentation inventories.
- Preservation: Existing workspace/system/test and domain stock retain operational details. Added language/naming/purity conventions and explicit architecture safeguards to shared stock where the previous wording was missing.
- Rationale: Keep mandatory entry guidance concise while preserving discoverable detailed rules.
- Affected stock:
  - [Workspace Design](../stock/shared/workspace.md): document ownership under `DOC-DISCOVERY-001`.
  - [Shared Design Principles](../stock/shared/design-principles.md): language and coding conventions.
  - [System Design](../stock/shared/system-design.md): remote delivery, React sharing, module testability, and profile safeguards.
- Routing: [AGENTS.md](../../AGENTS.md) → [Documentation Map](../README.md).
- Validation: Python relative-link and whitespace checks and scoped `git diff --check`; reviewed retained safety rules and stock coverage. Application tests skipped because only documentation changed.
- Follow-up: Maintain detailed policy through stock and the map.
