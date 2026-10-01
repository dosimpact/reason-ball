# 2026-10-02 Independent workspace boundary

## WORKSPACE-BOUNDARY-001

- Context: the parent workspace glob included Reason Hwang despite its documented independent ownership. The user confirmed this project must own its pnpm root.
- Change: exclude `!20-portfolio/1-reason-hwang/**` in the parent workspace; prune its importers and unused dependencies from the parent lockfile. Keep the project manifest, workspace, lockfile, and Turbo configuration intact.
- Compatibility: parent `*:reason-hwang` scripts delegate using `pnpm -C 20-portfolio/1-reason-hwang`. Generic parent tasks do not include this project.
- Rationale: one authoritative dependency and task boundary for Reason Hwang.
- Stock: [Workspace Design](../stock/tech-shared/workspace.md#workspace-boundary-001-independent-root); parent README and AGENTS updated.

## Validation

- PASS: parent `pnpm -r list --depth -1 --json`: 19 projects, no Reason Hwang paths.
- PASS: project-scoped recursive list: 8 projects, all within Reason Hwang.
- PASS: both roots `install --lockfile-only --offline --frozen-lockfile --ignore-scripts`. This validates lockfile consistency without relinking installed dependencies.
- PASS: independent Turbo `build --dry=json` discovers its own package graph. No builds or servers started.
- PASS: remaining parent lockfile importer blocks match HEAD; only Reason Hwang importers removed.
- Local installed dependencies can be refreshed with `pnpm -C 20-portfolio/1-reason-hwang install --frozen-lockfile` before development.
