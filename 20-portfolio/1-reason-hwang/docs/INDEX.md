# Documentation Map

This directory is the canonical documentation entry point for `1-reason-hwang`.

## DOC-INDEX-003: Directory entry filenames

Use `INDEX.md` for navigation and document-selection guides under this project's `docs/`. Project and application package introductions outside this directory keep `README.md`. Link to an index file explicitly rather than relying on automatic README rendering. Historical flow records retain their original filenames and wording; the [rename record](flow/2026-09-20-document-index-naming.md) maps their old entry paths to the current ones.

## Progressive discovery

Read documents in this order, expanding only into the scope relevant to the task:

```text
AGENTS.md
  -> docs/INDEX.md
       -> stock/tech-shared/INDEX.md
            -> common decisions at stock/tech-shared/*.md
            -> package details at stock/tech-shared/<package>/
       -> stock/<domain-feature-name>/ when domain behavior is affected
       -> validation/ principles applicable to the change
       -> flow/ records relevant to that scope or decision
       -> supporting documents and implementation as needed
```

1. Start here after reading `AGENTS.md`; use the document tables below to select the task's domain and shared concerns.
2. Follow the [tech-shared map](stock/tech-shared/INDEX.md) in **공용 → 구체** order: read applicable common decisions at the root, then technical details for the affected package. For code design, implementation, or review, always read and apply [Shared Design Principles](stock/tech-shared/design-principles.md), including `DESIGN-SLAP-001`. For domain work, also follow the domain INDEX and its linked designs.
3. Read related [flow records](flow/) for decision context, validation evidence, and pending follow-ups. Use the Flow table below, then search by domain, requirement/decision ID, or affected stock path when the table does not cover the task. For example, run `rg -n 'DESIGN-SLAP-001' docs/flow` from the workspace root. Read matching records and follow their relevant links; do not load the entire history by default.
4. Follow supporting references or inspect code when needed to resolve a specific question. Stock remains the current-state authority; historical flow does not silently override it. Reconcile conflicts against implementation and accepted decisions.
5. During a material change, append a dated flow record with affected stock links and validation results. Before completion, synchronize accepted current-state changes into stock and update this map when document routing changes.

The shared navigation policy is recorded as `DOC-DISCOVERY-001` in [Workspace Design](stock/tech-shared/workspace.md#doc-discovery-001-documentation-navigation).

## Validation principles

Before implementation validation, read [Validation Principles](validation/INDEX.md) and follow all applicable procedures:

- [Server API E2E](validation/server-api.md): Bruno skill principles and mandatory HTTP-level E2E.
- [Pure View](validation/pure-view.md): mandatory Storybook testing.
- [Business behavior](validation/business-behavior.md): mandatory user-facing browser validation with Playwright MCP or Chrome DevTools MCP.

These documents own detailed validation procedures; [shared test design](stock/tech-shared/test-design.md) owns the common policy and package validation map. Run evidence belongs in dated flow records.

## Documentation model

Documentation is managed as two complementary systems:

- `stock/` is the canonical description of the currently accepted product and system state.
- `flow/` is the append-only history of decisions, changes, migrations, and validation results.

Stock has two complementary ownership axes: business domains and shared/package technical concerns. Business-domain directories describe stable business capabilities that may span applications. `tech-shared/` groups common decisions at its root and concrete technical documents by package below it.

```text
docs/
├── stock/
│   ├── tech-shared/
│   │   ├── INDEX.md             # 공용 → 구체 문서 지도
│   │   ├── *.md                 # 공통 비즈니스·기술 결정
│   │   ├── 1-fe-host/           # 프런트엔드 기술 문서
│   │   ├── 2-bff-apps/          # BFF 기술 문서
│   │   ├── 3-langgraph-fast/    # LangGraph 기술 문서
│   │   └── infra/              # 인프라 패키지별 기술 문서
│   ├── template/
│   ├── us-corporate-filings/
│   └── index-dcf-visualizer/
├── flow/
└── validation/
```

Use lowercase kebab-case for new domain directories: `stock/<domain-feature-name>/`.

### Templates

`stock/template/` is a reserved library for starting concise stock documents. It is not a business domain and its placeholders are not current-state facts.

| Template | Use when |
| --- | --- |
| [`stock/template/business-design.template.md`](stock/template/business-design.template.md) | Defining value, scope, business rules, policy decisions, and acceptance criteria |
| [`stock/template/system-design.template.md`](stock/template/system-design.template.md) | Defining runtime boundaries, contracts, data, technical decisions, constraints, and verification |

Copy only the required template into a domain directory, replace every placeholder, and delete irrelevant rows or sections. Prefer links to existing shared facts over repeating them.

## Stock documents

### Tech-shared: 공용 결정과 구체 기술 문서

`stock/tech-shared/` follows two scopes: common business/technical decisions live at its root; package-specific technical detail lives below `1-fe-host/`, `2-bff-apps/`, `3-langgraph-fast/`, and `infra/`. Domain-only business requirements remain in their domain directory. See the [tech-shared entry point](stock/tech-shared/INDEX.md) for the full map and preserved reference notes.

The technical subdirectories follow package ownership; the other stock directories continue to follow business domains. Read common decisions first, then the relevant package detail.

#### 공용: 여러 패키지에 적용되는 결정

| Document | Scope |
| --- | --- |
| [`stock/tech-shared/design-principles.md`](stock/tech-shared/design-principles.md) | Common code design principles, SLAP application criteria, and review guidance |
| [`stock/tech-shared/workspace.md`](stock/tech-shared/workspace.md) | Workspace ownership, packages, commands, and default endpoints |
| [`stock/tech-shared/system-design.md`](stock/tech-shared/system-design.md) | Overall runtime topology, shared architecture, persistence, and infrastructure |
| [`stock/tech-shared/test-design.md`](stock/tech-shared/test-design.md) | Workspace-wide validation layers and common test policy |

#### 구체: 패키지별 구현·운영 기술

| Package | Documents |
| --- | --- |
| `1-fe-host` | [Frontend architecture](stock/tech-shared/1-fe-host/2-frontend-side-architecture.md), [Storybook](stock/tech-shared/1-fe-host/storybook.md) |
| `2-bff-apps` | [BFF map](stock/tech-shared/2-bff-apps/INDEX.md), [Directory policy](stock/tech-shared/2-bff-apps/directory-policy.md), [Swagger/OpenAPI](stock/tech-shared/2-bff-apps/swagger-module.md) |
| `3-langgraph-fast` | [Package map](stock/tech-shared/3-langgraph-fast/INDEX.md), [DB saver](stock/tech-shared/3-langgraph-fast/3-langgraph-db-saver.md), [Graph DB](stock/tech-shared/3-langgraph-fast/4-graph-db.md) |
| `infra/1-infra-graph-rag` | [Infrastructure setup](stock/tech-shared/infra/1-infra-graph-rag/1-infra-l1-setup.md) |
| `infra/2-codex-oauth-proxy` | [OAuth proxy](stock/tech-shared/infra/2-codex-oauth-proxy/1-infra-l2-codex-proxy.md) |

### US corporate filings

[`stock/us-corporate-filings/`](stock/us-corporate-filings/) owns the collection, processing, persistence, retrieval, and analysis of US corporate filings such as 10-K and 10-Q.

| Document | Scope |
| --- | --- |
| [`stock/us-corporate-filings/INDEX.md`](stock/us-corporate-filings/INDEX.md) | Domain boundary, owning components, current capabilities, and documentation routing |
| [`stock/us-corporate-filings/system-design.md`](stock/us-corporate-filings/system-design.md) | Implemented PostgreSQL filing content, migration, constraints, and verification |

### Index DCF Visualizer

[`stock/index-dcf-visualizer/`](stock/index-dcf-visualizer/) owns the assumptions, calculations, presentation, and validation behavior of the Index DCF Visualizer.

| Document | Scope |
| --- | --- |
| [`stock/index-dcf-visualizer/INDEX.md`](stock/index-dcf-visualizer/INDEX.md) | Domain boundary, owning components, current capabilities, and documentation routing |

## Stock routing rules

1. Start with the relevant common decisions and package details in `stock/tech-shared/`; also read the target domain's stock before changing its behavior.
2. Put requirements, terminology, behavior, domain architecture, and domain-specific validation in that domain directory.
3. Put workspace topology, shared infrastructure, cross-domain contracts, and common engineering or validation rules in `stock/tech-shared/`.
4. Put implementation and operational detail in `stock/tech-shared/<package>/`. If a change affects common decisions, package details, or domain behavior together, update every affected scope and connect them with links instead of duplicating content.
5. Add a new `stock/<domain-feature-name>/` directory for a new business capability. Organize package-specific technical details under `stock/tech-shared/<package>/`; do not create a business domain merely for a deployable package.

## Flow documents

Flow documents remain in a single dated, append-only history. New records must identify the affected business domain or `tech-shared`, name the package when applicable, and link the exact stock documents they update. Historical records using the scope label `shared` remain unchanged.

| Document | Change |
| --- | --- |
| [`flow/2026-09-20-workspace-root.md`](flow/2026-09-20-workspace-root.md) | Established this directory as an independent pnpm/Turborepo workspace |
| [`flow/2026-09-20-documentation-reconciliation.md`](flow/2026-09-20-documentation-reconciliation.md) | Reconciled root guidance and canonical documentation with the implementation |
| [`flow/2026-09-20-oauth-proxy-image-cleanup.md`](flow/2026-09-20-oauth-proxy-image-cleanup.md) | Removed dead proxy container configuration and separated runtime from example dependencies |
| [`flow/2026-09-20-oauth-proxy-readme-bruno.md`](flow/2026-09-20-oauth-proxy-readme-bruno.md) | Reconciled OAuth proxy onboarding and Bruno collection behavior with current code |
| [`flow/2026-09-20-domain-documentation-structure.md`](flow/2026-09-20-domain-documentation-structure.md) | Introduced domain-feature stock directories and the shared documentation boundary |
| [`flow/2026-09-20-minimal-stock-templates.md`](flow/2026-09-20-minimal-stock-templates.md) | Added minimal business and system design templates for domain stock documents |
| [`flow/2026-09-20-sec-filing-database-content-design.md`](flow/2026-09-20-sec-filing-database-content-design.md) | Designed the staged transition from local filing files to PostgreSQL-backed content |
| [`flow/2026-09-20-sec-filing-database-content-implementation.md`](flow/2026-09-20-sec-filing-database-content-implementation.md) | Implemented DB-backed content and verified a real SEC Apple 10-K |
| [`flow/2026-09-20-langgraph-graph-db-stock.md`](flow/2026-09-20-langgraph-graph-db-stock.md) | Consolidated the implemented Neo4j Graph DB contract under the LangGraph package stock |

Existing flow records keep their original wording and paths as historical evidence. A later stock relocation does not rewrite an earlier record.

- [Tech-shared relocation](flow/2026-09-20-tech-shared-document-relocation.md): Renamed shared stock and moved master documents without changing their contents; records old-to-new paths.
- [Tech-shared entry guidance](flow/2026-09-20-tech-shared-entry-guidance.md): Updated AGENTS and this map with common-to-specific reading and writing rules.

- [`flow/2026-09-20-shared-slap-principle.md`](flow/2026-09-20-shared-slap-principle.md): Established the shared SLAP principle and required reading in `AGENTS.md`.
- [`flow/2026-09-20-progressive-documentation-discovery.md`](flow/2026-09-20-progressive-documentation-discovery.md): Routed required reading through this map and task-relevant stock/flow discovery.

- [`flow/2026-09-20-agents-guidance-simplification.md`](flow/2026-09-20-agents-guidance-simplification.md): Simplified agent entry guidance and preserved detailed rules in shared stock.

- [Mandatory validation policy](flow/2026-09-20-mandatory-validation-principles.md): Added API, Storybook, and MCP browser validation requirements.

- [Validation MCP setup](flow/2026-09-20-validation-mcp-setup.md): Installed and verified browser/Storybook MCPs and documented setup.

## Supporting documents

Detailed implementation notes are grouped by their technical owners:

- [Tech-shared package references](stock/tech-shared/INDEX.md): detailed technical notes moved from the former `master-docs/` without changing their contents.
- `2-bff-apps/src/us-corporate-filings/.docs/api-spec.md`: SEC API specification.
- `3-langgraph-fast/README.md`: FastAPI/LangGraph setup and runtime policy.
- `infra/1-infra-graph-rag/docs/`: Graph RAG infrastructure design and flow history.
- `infra/2-codex-oauth-proxy/docs/`: OAuth proxy design.

If a supporting document conflicts with code or a stock document, verify the implementation first and reconcile the appropriate domain stock document. Preserved imported notes may contain historical routes or paths. Use the [relocation map and reading rules](stock/tech-shared/INDEX.md) to resolve them; the move itself does not certify that every historical detail matches current code.

- [A2UI 시스템 설계](stock/tech-shared/a2ui-system/INDEX.md): 전체 UI Registry, 정적 카탈로그, SDK/프로토콜 버전 계약, Dynamic/Fixed 및 사용자 action.
