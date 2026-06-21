# Repository Guidelines

## Project Structure & Module Organization

This repository is currently an empty project scaffold. As code is added, keep the top-level layout predictable:

- `src/` for application source code and reusable modules.
- `tests/` for automated tests that mirror the structure of `src/`.
- `assets/` for static files such as images, audio, sample data, or fixtures.
- `docs/` for design notes, architecture decisions, and user-facing documentation.

Avoid placing implementation files directly in the repository root unless they are standard project entry points or configuration files.

## Build, Test, and Development Commands

No build system, package manager, or test runner is configured yet. When one is introduced, document the exact commands here and keep them runnable from the repository root. Recommended examples:

- `npm install` or equivalent: install project dependencies.
- `npm run dev`: start a local development server.
- `npm test`: run the automated test suite.
- `npm run build`: create a production build.

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

This directory is not currently initialized as a Git repository, so no local commit history is available. Once Git is configured, use concise, imperative commit subjects such as `Add game loop` or `Fix score reset`. Pull requests should include a short summary, test results, linked issues when applicable, and screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

Before editing, inspect the repository state and avoid overwriting user-created files. Keep changes scoped to the requested task, and update this guide when project tooling or structure changes.
