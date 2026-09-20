# Documentation Map

This directory is the canonical documentation entry point for `1-reason-hwang`.

## Progressive discovery

Read documents in this order, expanding only into the scope relevant to the task:

```text
AGENTS.md
  -> docs/README.md
       -> stock/shared/ + stock/<domain-feature-name>/
       -> validation/ principles applicable to the change
       -> flow/ records relevant to that scope or decision
       -> supporting documents and implementation as needed
```

1. Start here after reading `AGENTS.md`; use the document tables below to select the task's domain and shared concerns.
2. Read the relevant [stock documents](stock/) to establish the current accepted state. For code design, implementation, or review, always read and apply [Shared Design Principles](stock/shared/design-principles.md), including `DESIGN-SLAP-001`. Select workspace, system, and test guidance from the Shared table as applicable. For domain work, follow the domain README and its linked designs.
3. Read related [flow records](flow/) for decision context, validation evidence, and pending follow-ups. Use the Flow table below, then search by domain, requirement/decision ID, or affected stock path when the table does not cover the task. For example, run `rg -n 'DESIGN-SLAP-001' docs/flow` from the workspace root. Read matching records and follow their relevant links; do not load the entire history by default.
4. Follow supporting references or inspect code when needed to resolve a specific question. Stock remains the current-state authority; historical flow does not silently override it. Reconcile conflicts against implementation and accepted decisions.
5. During a material change, append a dated flow record with affected stock links and validation results. Before completion, synchronize accepted current-state changes into stock and update this map when document routing changes.

The shared navigation policy is recorded as `DOC-DISCOVERY-001` in [Workspace Design](stock/shared/workspace.md#doc-discovery-001-documentation-navigation).

## Validation principles

Before implementation validation, read [Validation Principles](validation/README.md) and follow all applicable procedures:

- [Server API E2E](validation/server-api.md): Bruno skill principles and mandatory HTTP-level E2E.
- [Pure View](validation/pure-view.md): mandatory Storybook testing.
- [Business behavior](validation/business-behavior.md): mandatory user-facing browser validation with Playwright MCP or Chrome DevTools MCP.

These documents own detailed validation procedures; [shared test design](stock/shared/test-design.md) owns the common policy and package validation map. Run evidence belongs in dated flow records.

## Documentation model

Documentation is managed as two complementary systems:

- `stock/` is the canonical description of the currently accepted product and system state.
- `flow/` is the append-only history of decisions, changes, migrations, and validation results.

Stock documents are grouped by domain feature. A domain feature is a stable business capability and may span multiple applications, services, and infrastructure packages.

```text
docs/
├── stock/
│   ├── shared/
│   ├── template/
│   ├── us-corporate-filings/
│   └── index-dcf-visualizer/
└── flow/
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

### Shared

`stock/shared/` contains the overall system view and rules used by more than one domain. Domain-specific requirements and detailed behavior belong in the appropriate domain directory.

| Document | Scope |
| --- | --- |
| [`stock/shared/design-principles.md`](stock/shared/design-principles.md) | Common code design principles, SLAP application criteria, and review guidance |
| [`stock/shared/workspace.md`](stock/shared/workspace.md) | Workspace ownership, packages, commands, and default endpoints |
| [`stock/shared/system-design.md`](stock/shared/system-design.md) | Overall runtime topology, shared architecture, persistence, and infrastructure |
| [`stock/shared/test-design.md`](stock/shared/test-design.md) | Workspace-wide validation layers and common test policy |
| [`stock/shared/storybook.md`](stock/shared/storybook.md) | Host UI story fixtures, composition, and rendering validation |

### US corporate filings

[`stock/us-corporate-filings/`](stock/us-corporate-filings/) owns the collection, processing, persistence, retrieval, and analysis of US corporate filings such as 10-K and 10-Q.

| Document | Scope |
| --- | --- |
| [`stock/us-corporate-filings/README.md`](stock/us-corporate-filings/README.md) | Domain boundary, owning components, current capabilities, and documentation routing |
| [`stock/us-corporate-filings/system-design.md`](stock/us-corporate-filings/system-design.md) | Implemented PostgreSQL filing content, migration, constraints, and verification |

### Index DCF Visualizer

[`stock/index-dcf-visualizer/`](stock/index-dcf-visualizer/) owns the assumptions, calculations, presentation, and validation behavior of the Index DCF Visualizer.

| Document | Scope |
| --- | --- |
| [`stock/index-dcf-visualizer/README.md`](stock/index-dcf-visualizer/README.md) | Domain boundary, owning components, current capabilities, and documentation routing |

## Stock routing rules

1. Start with the target domain's stock directory before planning or implementation.
2. Put requirements, terminology, behavior, domain architecture, and domain-specific validation in that domain directory.
3. Put workspace topology, shared infrastructure, cross-domain contracts, and common engineering or validation rules in `stock/shared/`.
4. When a change affects a domain and a shared contract, update both locations without duplicating unnecessary implementation detail.
5. Add a new `stock/<domain-feature-name>/` directory when a stable business capability does not fit an existing domain. Do not organize stock primarily by deployable package.

## Flow documents

Flow documents remain in a single dated, append-only history. New records must identify the affected domain (`us-corporate-filings`, `index-dcf-visualizer`, or `shared`) and link the exact stock documents they update.

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

Existing flow records keep their original wording and paths as historical evidence. A later stock relocation does not rewrite an earlier record.

- [`flow/2026-09-20-shared-slap-principle.md`](flow/2026-09-20-shared-slap-principle.md): Established the shared SLAP principle and required reading in `AGENTS.md`.
- [`flow/2026-09-20-progressive-documentation-discovery.md`](flow/2026-09-20-progressive-documentation-discovery.md): Routed required reading through this map and task-relevant stock/flow discovery.

- [`flow/2026-09-20-agents-guidance-simplification.md`](flow/2026-09-20-agents-guidance-simplification.md): Simplified agent entry guidance and preserved detailed rules in shared stock.

- [Mandatory validation policy](flow/2026-09-20-mandatory-validation-principles.md): Added API, Storybook, and MCP browser validation requirements.

- [Validation MCP setup](flow/2026-09-20-validation-mcp-setup.md): Installed and verified browser/Storybook MCPs and documented setup.

## Supporting documents

Detailed implementation notes remain near their owners:

- `master-docs/`: cross-component and historical technical notes.
- `2-bff-apps/src/sec/API_SPEC.md`: SEC API specification.
- `3-langgraph-fast/README.md`: FastAPI/LangGraph setup and runtime policy.
- `infra/1-infra-graph-rag/docs/`: Graph RAG infrastructure design and flow history.
- `infra/2-codex-oauth-proxy/docs/`: OAuth proxy design.

If a supporting document conflicts with code or a stock document, verify the implementation first and reconcile the appropriate domain stock document. Older route examples under `master-docs/` may describe the original `/apps/*` convention; the implemented host convention is `/remotes/*`.
