# Test and Validation Design

> Scope: shared validation layers and workspace-wide test policy. Domain scenarios and acceptance criteria belong in the relevant `docs/stock/<domain-feature-name>/` directory.

## Mandatory change-based validation

The current policy requires all applicable checks: `VAL-API-001` for server API changes (Bruno API E2E), `VAL-VIEW-001` for pure View changes (Storybook), and `VAL-BROWSER-001` for changes containing business logic (user-facing browser behavior through Playwright MCP or Chrome DevTools MCP).

Detailed procedures and completion/evidence rules are canonical in [Validation Principles](../../validation/INDEX.md). Read them before selecting checks. Unit tests, lint, type checks, builds, and CLI E2E alone do not replace the required methods. Missing environments or tools must be reported as incomplete validation; existing opt-in database test policy does not waive required API E2E.

## Validation resource lifecycle

`VAL-CLEANUP-001` applies to every execution check: track ownership before starting, clean up on success/failure/interruption, and verify owned processes, child processes, ports, and temporary resources are released. Preserve user browsers and shared MCP servers. Functional PASS does not imply cleanup completion; unresolved cleanup must be reported separately and prevents declaring the whole task complete.

The canonical procedure is [Validation resource cleanup](../../validation/INDEX.md#val-cleanup-001), with [Playwright MCP and Chrome CDP details](../../validation/business-behavior.md#browser-cleanup). Record cleanup evidence in flow alongside functional results.

## Validation tooling

Installation and connection steps are maintained in the [workspace README](../../../README.md#검증용-mcp-설치-및-연결). The verified setup uses Playwright MCP `0.0.82` and Chrome DevTools MCP `1.9.0` through npx with isolated headless Chrome, plus the existing Storybook MCP addon `10.6.0` at `http://127.0.0.1:6006/mcp`. Bruno CLI `4.1.0` runs API collections without a separate MCP server.

MCP registrations live in the user's Codex configuration, not the repository. Storybook requires an independently started development server; registration alone does not verify connectivity or tests. Installation smoke checks do not count as feature validation.

## Validation layers

Validation is split by failure type. Run the narrowest relevant checks during implementation and the root checks before completing a cross-package change.

| Layer | Root command | Purpose |
| --- | --- | --- |
| Lint | `pnpm lint` | ESLint, Ruff, TypeScript-based package lint checks, and Python syntax checks as defined by packages |
| Type checking | `pnpm typecheck` | TypeScript and Pyright checks where configured |
| Build | `pnpm build` | Next.js, NestJS, Vite remotes, Python package, and image build tasks that exist |
| Unit/integration tests | `pnpm test` | Package test suites through Turbo |
| Browser E2E | `pnpm test:e2e` | Host Playwright tests |
| Infrastructure health | `pnpm infra:ps` | Compose state and package-specific health checks |

Turbo only runs a task for packages that define the corresponding script. A successful root command therefore means all participating packages passed, not that every package implements that test type.

## Frontend validation

`1-fe-host/tests/e2e/` contains Playwright coverage for:

- Template and Todo remotes on `/remotes/template` and `/remotes/todo`.
- Chat behavior.
- Index DCF calculation logic exposed through the UI.
- Index DCF visualizer interaction and warning behavior.

Playwright owns its configured host server. Do not reuse or terminate unrelated development servers. Use `pnpm --filter @reason-hwang/fe-host test:e2e` for the full suite or the committed focused script for calculation-only checks.

## BFF validation

The BFF package uses its committed `test` script for Node tests when present and TypeScript checking through its `lint` script. API workflow coverage is maintained as a Bruno collection under `2-bff-apps/bruno-api-tests/` for:

- Company synchronization and listing.
- Selected/all-company backfill SSE: metadata first, optional document download and internal retries.
- Filing pagination, original/amendment linkage, optional content and response byte budget.

`test:companies:e2e` and `test:filing-routes:e2e` own an isolated PostgreSQL container and Nest HTTP port; external SEC alone uses fixtures. The public Bruno collection is separate from deterministic test fixtures. `test:sec-live`, `sec:import-files`, and `scripts/run-sec-backfill.cjs` are explicit data-changing operations.

Bruno environments separate local, development, and staging base URLs. Tests that mutate SEC or database state require an explicitly prepared environment.

## FastAPI/LangGraph validation

`3-langgraph-fast/tests/` uses pytest and covers:

- Domain logic and 10-K parsing/retrieval.
- Graph workflows, tools, caching, and value objects.
- Technical-analysis indicator implementations and architecture boundaries.
- FastAPI contracts, execution limits, threads, runs, persistence, and extensions.
- PostgreSQL repositories, normalized schema, checkpointer behavior, and migrations.

Common commands include:

```sh
pnpm --filter @reason-hwang/langgraph-fast-api test
pnpm --filter @reason-hwang/langgraph-fast-api test:api
pnpm --filter @reason-hwang/langgraph-fast-api test:technical-analysis
pnpm --filter @reason-hwang/langgraph-fast-api test:model1
pnpm --filter @reason-hwang/langgraph-fast-api test:sec-modeling
```

PostgreSQL and Neo4j integration tests require their documented services and opt-in environment flags. Do not reinterpret a skipped external-service test as a passing integration verification.

The Bruno collection under `3-langgraph-fast/bruno-api-tests/` exercises health/system endpoints, parsing, Assistants, MCP, Threads, Runs, streaming, Crons, Store, and A2A against a running server.

Open either package's committed collection in the Bruno desktop app from that package directory:

```sh
pnpm bruno
```

## OAuth proxy validation

`infra/2-codex-oauth-proxy/tests/` uses Python unittest for translation and proxy behavior through `pnpm test:unit`. API-level Bruno checks run through `pnpm test:api`; the runner validates local OAuth credentials, owns or refreshes the Compose proxy, checks health, and exercises Chat Completions, supported-model listing, and model-alias behavior against the live Codex upstream.

Never expose token contents in test output or commit `.config/chatgpt_auth.json`.

## Infrastructure validation

After `pnpm infra:up`, verify at minimum:

```sh
pnpm infra:ps
curl http://localhost:3100/ready
curl http://localhost:9090/-/ready
curl http://localhost:9090/api/v1/targets
curl http://localhost:8080/healthz
```

Prometheus targets for cAdvisor, PostgreSQL, Neo4j, exporter self-metrics, and Prometheus should be `UP` as applicable. Confirm provisioned Loki and Prometheus data sources in Grafana when changing monitoring configuration.

## Completion evidence

A flow record should list the exact commands executed and their PASS, FAIL, or SKIP result. If a check is skipped, state the missing service, credential, or environment requirement. Documentation-only changes require at least structural/link checks and a diff review; they do not require application builds unless the documentation was derived from uncertain runtime behavior.

## SEC-MODELING-001: 통합 모델링 검증

- BFF `test:modeling:e2e`: 격리 PostgreSQL·실제 HTTP에서 작업 중복, lease, 실패·취소·재시도,
  게시 결과 복구, terminal run/work unit 정합성을 검증하고 Bruno를 실행한다.
- Python `test:sec-modeling`: 문서 경계·청킹·XBRL 변환·근거 격리·캐시·검색·단위 필터 검증.
  `test:sec-modeling:api`는 준비된 실제 서비스의 Bruno 요청이다.
- Host `test:sec-modeling`, `test:sec-modeling:views`: API/state 단위와 Storybook view 검증.
- 실제 3개 공시 모델링과 MCP Admin 검증은 fixture 검증과 구분해 flow에 기록한다.
- `validate:sec-retrieval`은 한국어15·영어15 질문으로 Recall@10≥90%, 공시 혼입0,
  근거 조회100%를 검사한다. `validate:sec-model2`는 실제 모델 호출·Neo4j 쓰기를 수행하므로
  명시적으로 실행한다. 중간 subset 결과를 전체30문항 통과로 간주하지 않는다.

[도메인 계약](../us-corporate-filings/sec-modeling.md)의 인수 기준과
[검증 자원 정리](../../validation/INDEX.md#val-cleanup-001)를 함께 적용한다.
