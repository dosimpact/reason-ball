# Repository Guidelines

## Project Structure & Module Organization

This repository is a pnpm workspace managed with Turborepo. Keep the top-level layout predictable:

- `apps/` for runnable applications.
- `packages/` for shared packages and reusable modules.
- `assets/` for static files such as images, audio, sample data, or fixtures.
- `docs/` for design notes, architecture decisions, and user-facing documentation.
- `21-mini-projects/` for independent workspace mini projects. `todo-list-mcp` is a single Next.js UI/API/MCP application.

Avoid placing implementation files directly in the repository root unless they are standard project entry points or configuration files.

## Build, Test, and Development Commands

Use committed package scripts from the repository root:

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: run development tasks through Turborepo.
- `pnpm build`: run production builds through Turborepo.
- `pnpm test`: run test tasks through Turborepo.
- `pnpm lint`: run lint tasks through Turborepo.
- `pnpm typecheck`: run type-check tasks through Turborepo.

Prefer scripts committed in the project manifest over one-off local commands.

For Todo MCP, use `pnpm --filter todo-list-mcp dev` and scoped `test`, `test:e2e`, `typecheck`, `lint`, and `build` scripts. E2E runs headless against an owned server and temporary JSON, then releases its port. Never reuse or terminate unrelated development servers. Keep its core transformations pure and follow SLAP; local runtime JSON is not committed.

## Coding Style & Naming Conventions

Use consistent, language-appropriate formatting once the stack is selected. Until formatter configuration exists, keep files readable with two-space indentation for web assets and four-space indentation for Python-style code. Use descriptive names:

- `camelCase` for JavaScript/TypeScript variables and functions.
- `PascalCase` for classes and components.
- `snake_case` for Python modules, functions, and variables.
- `kebab-case` for static asset filenames.

Add formatter and linter configs early, then treat their output as authoritative.

## Testing Guidelines

Place tests under `tests/` or next to source files using the convention selected by the framework. Name test files clearly, such as `feature.test.ts`, `module.spec.js`, or `test_module.py`. Cover core logic, public interfaces, and regression cases before adding broad end-to-end tests.

## Documentation: Stock and Flow

Maintain project documentation as two complementary systems:

- **Stock documents (저량 문서)** are the canonical, current-state source of truth. Keep one consolidated business design and one consolidated system/development design per project. They must describe the latest agreed product behavior and implemented architecture without requiring readers to reconstruct the present state from historical logs.
- **Flow documents (유량 문서)** are append-only, point-in-time change records. Record decisions, requirement changes, architecture changes, migrations, validation results, and important implementation notes as they occur. Include the date, context, change, rationale, affected stock sections, and validation or follow-up status.

Use the following operating rules:

1. Read the relevant stock documents before planning or implementing a material change.
2. During work, create or update a dated flow record so the change history and reasoning are preserved.
3. Before declaring the work complete, fold every accepted current-state change into the relevant stock documents. A flow record does not replace this synchronization.
4. When code, stock, and flow disagree, verify the implementation and accepted decision, then update the stock document to the confirmed current state and note the reconciliation in flow.
5. Link stock and flow documents using stable requirement or decision IDs when practical, and link validation evidence to the requirement it verifies.
6. Do not copy historical narrative into stock documents unless it is necessary to understand the current design. Do not rewrite or erase historical flow records; supersede them with a new dated entry.
7. Store stock documents in a predictable project documentation area such as `docs/stock/`. Store flow records in a dated history area such as `docs/flow/`.

For `20-portfolio/3-fsd-next-sample`, use `docs/stock/` for the consolidated business, system, and test designs and `docs/flow/` for dated progress, audit, decision, migration, and validation records. Start with `docs/README.md` for the document map.

## Commit & Pull Request Guidelines

Use concise, imperative commit subjects such as `Add game loop` or `Fix score reset`. Pull requests should include a short summary, test results, linked issues when applicable, and screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

Before editing, inspect the repository state and avoid overwriting user-created files. Keep changes scoped to the requested task, and update this guide when project tooling or structure changes.


## Response Format (MANDATORY)

ALWAYS include at the end of each response:
- **Learning Points**: 3-5 key concepts the user should learn
- **Next Step**: Specific action with command/tool suggestion
- Use clear terms and avoid forcing responses into fixed project-type categories.
