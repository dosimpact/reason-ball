# Tech-shared entry guidance

- Date: 2026-09-20
- Scope: tech-shared documentation, DOC-SCOPE-002
- Context: After moving shared stock and preserving master-docs under package-specific directories, the user requested explicit updates to both entry documents.
- Change:
  - AGENTS now directs readers through common decisions, package details, and applicable business-domain stock.
  - AGENTS documents where to write common versus concrete changes, stock/flow synchronization, and preservation of imported originals.
  - The documentation map now displays package directories, separates common and concrete tables, and links each relocated technical document.
  - New flow records use tech-shared as the scope where applicable; old shared labels and original flow records are preserved.
- Affected documents:
  - [AGENTS](../../AGENTS.md)
  - [Documentation map](../README.md)
  - Canonical policy: [DOC-SCOPE-002](../stock/tech-shared/README.md#doc-scope-002-공용과-구체의-두-가지-범위)
- Validation: Relative file links and scoped diff whitespace checks; runtime tests do not apply to this documentation-only update. Imported master documents are unchanged.
