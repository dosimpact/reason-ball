# Progressive Documentation Discovery

- Date: 2026-09-20
- Domain: `shared`
- Decision ID: `DOC-DISCOVERY-001`
- Context: User requested progressive discovery from `AGENTS.md` through `docs/README.md` into stock and flow.
- Change: Replaced the direct SLAP reading link in `AGENTS.md` with map-based discovery. The map now requires relevant stock, related flow, and shared design principles for code work, and explains how to search additional history.
- Rationale: Centralize document selection in the map while retaining mandatory principles and limiting reading to relevant context.
- Affected stock: [Workspace Design — DOC-DISCOVERY-001](../stock/shared/workspace.md#doc-discovery-001-documentation-navigation).
- Routing: [AGENTS.md](../../AGENTS.md), [Documentation Map](../README.md#progressive-discovery).
- Supersedes: The direct reading route introduced in [SLAP adoption](2026-09-20-shared-slap-principle.md); `DESIGN-SLAP-001` itself remains unchanged and required through the map.
- Validation: Added navigation links and anchors checked with Python; scoped `git diff --check` performed. Application tests are not applicable to this documentation-only change.
- Follow-up: Use the map to discover relevant stock and flow before future changes.
