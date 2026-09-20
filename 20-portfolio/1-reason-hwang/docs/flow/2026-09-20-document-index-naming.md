# Documentation index naming

- Date: 2026-09-20
- Scope: tech-shared documentation, DOC-INDEX-003
- Context: User prefers INDEX.md over README.md for entry documents under the project docs directory.
- Change: Renamed the five documentation entry files and updated current navigation links, AGENTS guidance and the root README's validation link. Project/package READMEs outside this docs directory remain unchanged in name. Master-document originals remain byte-for-byte preserved.
- Affected stock: [tech-shared index](../stock/tech-shared/INDEX.md), [workspace navigation](../stock/tech-shared/workspace.md), [test design](../stock/tech-shared/test-design.md), [system design](../stock/tech-shared/system-design.md), [SEC index](../stock/us-corporate-filings/INDEX.md), [DCF index](../stock/index-dcf-visualizer/INDEX.md).

| Previous entry | Current entry |
| --- | --- |
| `docs/README.md` | [docs/INDEX.md](../INDEX.md) |
| `docs/stock/tech-shared/README.md` | [tech-shared/INDEX.md](../stock/tech-shared/INDEX.md) |
| `docs/stock/us-corporate-filings/README.md` | [us-corporate-filings/INDEX.md](../stock/us-corporate-filings/INDEX.md) |
| `docs/stock/index-dcf-visualizer/README.md` | [index-dcf-visualizer/INDEX.md](../stock/index-dcf-visualizer/INDEX.md) |
| `docs/validation/README.md` | [validation/INDEX.md](../validation/INDEX.md) |

- Historical flow records remain append-only and retain their old references; resolve them through this table and the [tech-shared relocation record](2026-09-20-tech-shared-document-relocation.md).
- Validation: PASS — 108 current relative file links resolve; no README.md entry remains under docs; diff whitespace checks pass. Runtime tests do not apply to filename/navigation changes.
