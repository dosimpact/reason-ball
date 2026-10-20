# 2026-10-19 — SDK-GRAPH-GROUPS

## Context and decision

The 49 backend entry points were flat under `graphs/`. Group them using the existing frontend catalog so AG-UI and other learning paths are easy to locate.

## Changes and rationale

- Move 01–07 to `mvp/`, 08–20 and 48–49 to `core/`, 21–28 to `generative_ui/`, 29–34 to `artifact/`, and 35–47 to `copilotkit/`.
- Add package initializers; update LangGraph registration paths, Python test/smoke imports, current plans and documentation.
- Preserve graph IDs, graph implementations, frontend/runtime contracts, and append-only historical records.
- Affected stock: `docs/stock/system-design.md`, SDK-GRAPH-GROUPS and example-25 source path. Business behavior is unchanged.

## Validation

- PASS: `uv run --extra dev pytest -q` — 50 tests; all 49 configured paths and graph exports load. Tests now derive entries from `langgraph.json`, covering previously omitted AG-UI entries and example 48.
- AG-UI construction initially required API credentials; the import test now supplies a local fake tool-capable model through monkeypatch, with no provider calls.
- PASS: all 49 graph IDs equal HEAD; moved graph file contents are byte-identical to HEAD.
- PASS: `git diff --check`; no stale flat paths in current config/code/plans/stock. Two historical paths remain intentionally in flow/progress.
- Existing warning: example 17 uses deprecated `config_schema`; unchanged by this refactor.
- No live server, browser or provider execution; running services were not restarted.
