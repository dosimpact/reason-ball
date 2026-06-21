# Repository Guidelines

## Project Structure & Module Organization

This repository is a pnpm workspace managed with Turborepo. Keep the top-level layout predictable:

- `apps/` for runnable applications.
- `packages/` for shared packages and reusable modules.
- `assets/` for static files such as images, audio, sample data, or fixtures.
- `docs/` for design notes, architecture decisions, and user-facing documentation.

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

## Coding Style & Naming Conventions

Use consistent, language-appropriate formatting once the stack is selected. Until formatter configuration exists, keep files readable with two-space indentation for web assets and four-space indentation for Python-style code. Use descriptive names:

- `camelCase` for JavaScript/TypeScript variables and functions.
- `PascalCase` for classes and components.
- `snake_case` for Python modules, functions, and variables.
- `kebab-case` for static asset filenames.

Add formatter and linter configs early, then treat their output as authoritative.

## Testing Guidelines

Place tests under `tests/` or next to source files using the convention selected by the framework. Name test files clearly, such as `feature.test.ts`, `module.spec.js`, or `test_module.py`. Cover core logic, public interfaces, and regression cases before adding broad end-to-end tests.

## Commit & Pull Request Guidelines

Use concise, imperative commit subjects such as `Add game loop` or `Fix score reset`. Pull requests should include a short summary, test results, linked issues when applicable, and screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

Before editing, inspect the repository state and avoid overwriting user-created files. Keep changes scoped to the requested task, and update this guide when project tooling or structure changes.
