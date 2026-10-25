# Python LangGraph + Next.js example

Read `docs/stock/business.md` and `docs/stock/system.md` before material changes; append dated decisions and evidence under `docs/flow/` and synchronize stock.

- `backend-langgraph/` is an independent Python 3.12/uv project. Run `uv sync --frozen`, `uv run pytest`, `uv run ruff check agent tests` from that directory. Start with `uv run langgraph dev --port 2034 --no-browser`.
- `frontend/` is an independent Next.js/pnpm project. Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm verify` from that directory. `npm run dev` uses port 3042.
- Keep runtime, manifests, locks, environment files and tests inside their owning project. Connect only over HTTP; do not add runtime imports or filesystem reads across the two projects.
- Backend owns OPENAI_API_KEY. Frontend owns LANGGRAPH_API_URL / LANGGRAPH_ASSISTANT_ID and optional deployment authentication. Never print or commit real credentials.
- The backend prompt is a packaged asset. Updating the frontend component contract requires explicitly exporting and updating that asset, followed by integration verification.
- `npm run test:smoke` inside frontend makes real provider calls against running servers. Preserve unrelated servers, especially the sibling JS example on 2024; stop only task-owned processes.
