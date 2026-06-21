# Repository Guidelines

## Project Structure & Module Organization

This subproject is for LangGraph SDK learning examples with a TypeScript/React frontend and LangGraph graph backends. The current files are `goal.md` for the roadmap and `.env.example` for safe configuration. Keep implementation files organized by concern:

- `graph/` or `graphs/`: LangGraph graph entry points, matching examples from `../1-langgraph-basic/`.
- `src/`: React frontend code, SDK client helpers, routing, and shared UI.
- `src/examples/`: one component entry per learning example, such as `01-sdk-connection`.
- `tests/` or `e2e/`: unit, integration, and browser tests.
- `plan/`: design documents for each example before implementation.
- `e2e-plan/`: Playwright E2E test plans for each example.
- `progress/`: tracking documents for planning, implementation, and E2E status.
- `assets/`: static images, fixtures, and sample files used by examples.

## Example Delivery Workflow

Use `goal.md` as the source of truth for the example list. Complete work in this order:

1. Plan every example before coding. Create `plan/{name}.md` with coding scope, graph requirements, frontend behavior, SDK calls, data/state model, risks, and acceptance criteria. Use subagents where useful, and track planning status in `progress/planning.md`.
2. After design documents are complete, build the boilerplate codebase: workspace package setup, React app shell, shared SDK client, graph server config, common UI primitives, lint/test tooling, and baseline scripts.
3. Implement each example from its plan. Track implementation status, blockers, and verification notes in `progress/implement.md`. Keep one graph plus one frontend example per learning topic unless the plan explicitly justifies otherwise.
4. Write E2E plans before browser automation. Create `e2e-plan/{name}.md` for each example, then run Playwright MCP-based tests and record progress in `progress/e2e-progress.md`.

Do not skip progress files. They are the coordination layer for multi-agent work and must be updated as tasks move from pending to in progress to complete.

## Build, Test, and Development Commands

This directory is included by the root `pnpm-workspace.yaml` through `17-langgraph/*`. After adding a `package.json`, expose local scripts and run them through pnpm:

```bash
pnpm install                  # install workspace dependencies
pnpm --filter <pkg> dev       # run the React example app
pnpm --filter <pkg> test      # run frontend tests
pnpm --filter <pkg> lint      # run lint checks
pnpm --filter <pkg> build     # build production assets
```

For graph work, mirror the sibling LangGraph projects and document the exact `uv run langgraph dev ...` command once `pyproject.toml` and `langgraph.json` exist.

## Coding Style & Naming Conventions

Use TypeScript for frontend code and keep React components in PascalCase. Name example folders with a numeric prefix and short kebab-case description, for example `03-streaming-ui`. Use 2-space indentation for TS/TSX/JSON/Markdown. Prefer shared SDK helpers over repeating LangGraph client setup in each example. Keep environment access centralized.

## Testing Guidelines

Add focused tests for each example flow. Use `*.test.ts` or `*.spec.ts` for unit/component tests and place browser flows under `e2e/`. Cover SDK connection, thread reuse, streaming states, interrupt resume, and checkpoint history before marking an example complete.

For E2E coverage, use Playwright MCP after the matching `e2e-plan/{name}.md` exists. Each E2E plan should list setup, user actions, expected UI states, backend assertions, and cleanup.

## Commit & Pull Request Guidelines

Recent history uses short messages such as `refactor`, `update`, and topic-based commits. Prefer more specific imperative messages, for example `add sdk thread lifecycle example`. Pull requests should include a summary, tested commands, linked issues, screenshots for UI changes, and any new environment variables.

## Security & Configuration Tips

Never commit `.env` or real API keys. Keep `.env.example` current when configuration changes. Use `OPENAI_API_KEY`, LangSmith keys, and third-party API keys only through local environment files or secret managers.
