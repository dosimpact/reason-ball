# Repository Guidelines

## Project Structure & Module Organization

This repository contains LangGraph learning examples backed by the OpenAI API.

- `common/`: shared infrastructure such as `create_llm()` and demo tools.
- `node/`: reusable LangGraph node factories and routing helpers.
- `graph-basic/`: numbered, self-contained LangGraph examples exposed by `langgraph.json`.
- `graph-advanced/`: advanced examples with their own local `common/` modules and optional dependencies.
- `test_*.py`: Python tests and end-to-end graph checks.
- `.env.example`: safe configuration template. `.env` is local-only and ignored.

## Build, Test, and Development Commands

Use `uv` for environment management.

```bash
uv sync                         # Install base dependencies
uv sync --extra advanced        # Install advanced-example dependencies
uv run python graph-basic/15_react_tool_loop.py
uv run langgraph dev --port 2025
uv run langgraph dev --config langgraph-advanced.json --port 2025
uv run pytest
```

`OPENAI_API_KEY` must be set in `.env` or exported in the shell before running LLM-backed examples.

## Coding Style & Naming Conventions

Use Python 3.10+ syntax with 4-space indentation and type hints where practical. Keep graph example files self-contained and named with the existing numeric pattern, for example `graph-basic/22_dynamic_interrupt.py`. Prefer shared helpers in `common/` and `node/` after a concept has first been introduced directly. Keep comments concise and focused on non-obvious behavior.

## Testing Guidelines

Tests use `pytest` for Python flows and graph checks. Name new Python tests `test_*.py`. For changes to graph behavior, add or update focused tests near the existing E2E examples. Run:

```bash
uv run pytest
```

For streaming or advanced examples, also run the target graph manually with `uv run python ...` or through LangGraph Studio. Keep the `01`~`44` curriculum order synchronized with `docs/graph-basic-curriculum.md` and `langgraph.json`.

## Commit & Pull Request Guidelines

No Git history is present in this workspace, so use clear imperative commit messages such as `Refactor LLM provider to OpenAI` or `Add semantic cache test`. Pull requests should include a short summary, test results, configuration changes, and any affected graph IDs. Link related issues when available.

## Security & Configuration Tips

Never commit `.env` or API keys. Keep `.env.example` updated when configuration changes. `uv.lock` should be committed when generated to keep installs reproducible. Avoid reintroducing Bedrock/AWS runtime dependencies unless the provider migration is intentionally reversed.
