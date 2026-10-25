# OpenUI shadcn + Python LangGraph

Read docs/stock/business.md and docs/stock/system.md before material changes. Append dated records under docs/flow and synchronize stock before completion.

- Scope changes to this project. Preserve original-reference and sibling projects.
- frontend is an independent pnpm project. Use pnpm install --frozen-lockfile, pnpm generate, pnpm typecheck, pnpm lint, pnpm build. Dev port: 3046.
- backend-langgraph is an independent Python 3.12/uv project. Use uv sync --frozen, uv run pytest, uv run ruff check agent tests. Start: uv run langgraph dev --port 2038 --no-browser.
- Frontend uses the copied shadcnChatLibrary and AG-UI adapter. Python owns OpenAI credentials and tool execution. Runtime projects communicate only over HTTP.
- After changing the catalog run pnpm generate and pnpm sync:prompt inside frontend, then restart Python. Keep backend prompt as a packaged asset.
- pnpm test:smoke and pnpm test:e2e call the real model with running servers. E2E uses installed Google Chrome; output lives under frontend/output.
- Never print or commit real credentials. Preserve environment files and runtime data. Stop only task-owned servers and close only test-owned browser tabs.
