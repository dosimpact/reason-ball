# OpenUI Dynamic Canvas + Python LangGraph

Read `docs/stock/business.md` and `docs/stock/system.md` before material changes; append dated decisions and evidence under `docs/flow/` and synchronize stock.

- `backend-langgraph/` is an independent Python 3.12/uv project. Run `uv sync --frozen`, `uv run pytest`, `uv run ruff check agent tests` from that directory. Start with `uv run langgraph dev --port 2037 --no-browser`.
- `frontend/` is an independent Next.js/npm project. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run verify` from that directory. `npm run dev` uses port 3045.
- Keep runtime, manifests, locks, environment files and tests inside their owning project. Connect only over HTTP; do not add runtime imports or filesystem reads across the two projects.
- Backend owns OPENAI_API_KEY. Frontend owns LANGGRAPH_API_URL / LANGGRAPH_ASSISTANT_ID and optional deployment authentication. Never print or commit real credentials.
- The backend prompt is a packaged asset. Updating the frontend component contract requires explicitly exporting and updating that asset, followed by integration verification.
- `npm run test:smoke` inside frontend makes real provider calls against running servers. Preserve unrelated servers, especially the sibling JS example on 2024; stop only task-owned processes.

This is the independent OpenUI Dynamic Canvas project based on the Intelligent UI Python copy. Preserve siblings 6, 6-2 and open-intelligent-ui. Ports 2037/3045. Use npm/package-lock.json only in frontend. Run npm run generate before typecheck/test/build after a clean install, then explicitly sync the generated prompt to Python. src/lib and gallery/preview originate from open-intelligent-ui; preserve their source unless the task requires a change. LocalStorage stores Canvas documents and Chat. DuckDB/query definitions live in ignored backend runtime/. Historical copied flow records describe the source project.
