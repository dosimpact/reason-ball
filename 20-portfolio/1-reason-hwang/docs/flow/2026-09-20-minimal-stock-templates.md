# Minimal Stock Document Templates

- Date: 2026-09-20
- Domain: `shared`
- Context: Domain-oriented stock documentation needs a repeatable starting point without importing large PDCA documents or unnecessary historical context.
- Change:
  - Added a minimal business design template for scope, flow, rules, decisions, completion criteria, and open questions.
  - Added a minimal system design template for structure, boundaries, contracts, data, decisions, constraints, and verification.
  - Reserved `docs/stock/template/` as a template library rather than a domain or current-state source.
- Rationale: Preserve the minimum information needed to understand and verify present design decisions while keeping chronology in flow records.
- Affected stock documents:
  - `docs/stock/template/business-design.template.md`
  - `docs/stock/template/system-design.template.md`
  - `docs/README.md`
- Validation:
  - Confirmed both templates contain only the minimum current-state and decision sections selected for their document type.
  - Confirmed intentional placeholders are present and the template usage policy requires replacing or removing them in copied stock documents.
  - Confirmed template links in `docs/README.md` resolve.
  - `git diff --check`: PASS.
