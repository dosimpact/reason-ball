# 2026-09-20 — Documentation reconciliation

## Context

The root agent guidance still described the initial two-application micro-frontend plan. It referenced missing `tasks/1-init.md` and `아키텍처.md` files, used the superseded `/apps/*` route convention, and omitted the FastAPI/LangGraph and infrastructure packages. The canonical `docs/stock/` area only described workspace ownership.

## Change

- Replaced the planned project tree in `AGENTS.md` with the implemented seven-package workspace.
- Corrected host remote routes to `/remotes/template` and `/remotes/todo`.
- Documented TypeScript and Python ownership, root commands, default endpoints, architecture invariants, testing locations, security boundaries, and stock/flow operating rules.
- Added `docs/README.md` as the canonical document map.
- Expanded `docs/stock/workspace.md` with package names, commands, endpoint defaults, and configuration ownership.
- Added `docs/stock/system-design.md` for the current frontend, BFF/SEC, LangGraph, persistence, OAuth proxy, and observability topology.
- Added `docs/stock/test-design.md` for static analysis, builds, browser/API/unit/integration tests, and environment-dependent checks.
- Corrected the root README's infrastructure services and PostgreSQL default port.
- Updated the frontend architecture note to the implemented `/remotes/*` routes and Next.js same-origin proxy path.
- Marked the initial infrastructure setup note as historical and linked it to the current canonical designs.

## Rationale

Contributors should be able to determine the current project boundary and safe validation path without reconstructing the system from package manifests or relying on historical notes. Stock documents now describe the confirmed current state, while this record preserves why the reconciliation occurred.

## Affected stock sections

- `docs/stock/workspace.md`
- `docs/stock/system-design.md`
- `docs/stock/test-design.md`

## Validation

- Compared package scope with `pnpm-workspace.yaml` and `pnpm list --recursive --depth -1`.
- Compared commands with root and child `package.json` files.
- Compared frontend routes with `1-fe-host/src/app/`, sidebar navigation, and Playwright specs.
- Compared remote behavior with host/BFF registries and Vite Module Federation configuration.
- Compared BFF and LangGraph surfaces with application bootstrap code, routers, tests, and Bruno collections.
- Compared infrastructure endpoints with the current Compose and example environment configuration.
- Reviewed the final documentation diff and checked local Markdown links and referenced repository paths.

## Follow-up

Focused `master-docs/` remain supporting or historical documents rather than canonical stock. Use `docs/stock/` for current-state decisions and keep detailed notes synchronized when their subject changes.
