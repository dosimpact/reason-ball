# 2026-09-20 — Independent workspace root

## Context

Reason Hwang had grown beyond a small sub-area but its packages and commands were still owned by the repository-level pnpm workspace.

## Change

- Added a local `package.json`, `pnpm-workspace.yaml`, `turbo.json`, and lockfile.
- Moved Reason Hwang commands to the local workspace root.
- Excluded `20-portfolio/1-reason-hwang/**` from the repository-level workspace.
- Updated project instructions and usage documentation.

## Rationale

The project can now install, run, validate, and evolve its dependency graph independently while remaining in the same Git repository.

## Affected stock sections

- `docs/stock/workspace.md`

## Validation

- `pnpm install`: PASS; generated the local lockfile and resolved all 8 workspace projects including the root.
- `pnpm list --recursive --depth -1`: PASS; listed the 7 intended child packages.
- `pnpm exec turbo ls`: PASS; Turbo discovered the same 7 child packages.
- `pnpm exec turbo run build --dry=json`: PASS; Turbo resolved build tasks from the local root without executing application or image builds.
- Repository-root `pnpm install --lockfile-only`: PASS; refreshed the parent lockfile after excluding this workspace.
