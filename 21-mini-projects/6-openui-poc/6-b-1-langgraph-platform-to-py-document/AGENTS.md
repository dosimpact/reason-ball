# Python LangGraph + Next.js example

Read `docs/stock/business.md` and `docs/stock/system.md` before material changes; append dated decisions and evidence under `docs/flow/` and synchronize stock.

- `backend-langgraph/` is an independent Python 3.12/uv project. Run `uv sync --frozen`, `uv run pytest`, `uv run ruff check agent tests` from that directory. Start with `uv run langgraph dev --port 2035 --no-browser`.
- `frontend/` is an independent Next.js/npm project. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run verify` from that directory. `npm run dev` uses port 3043.
- Keep runtime, manifests, locks, environment files and tests inside their owning project. Connect only over HTTP; do not add runtime imports or filesystem reads across the two projects.
- Backend owns OPENAI_API_KEY. Frontend owns LANGGRAPH_API_URL / LANGGRAPH_ASSISTANT_ID and optional deployment authentication. Never print or commit real credentials.
- The backend prompt is a packaged asset. Updating the frontend component contract requires explicitly exporting and updating that asset, followed by integration verification.
- `npm run test:smoke` inside frontend makes real provider calls against running servers. Preserve unrelated servers, especially the sibling JS example on 2024; stop only task-owned processes.

This is the independent document-comparison migration copy. Preserve the sibling `6-langgraph-platform-to-py` project. Current functionality is the document-comparison UI backed by Python PDF preparation, search_documents, dynamic comparison prompts and durable SQLite conversations. Mock tools remain only as reference code/tests. Ports: backend 2035, frontend 3043. Treat inherited flow records as source-project history.

- Document preparation: `uv run prepare-documents` in backend-langgraph. Use `--no-samples` for local PDFs only. DOCUMENT_DATA_DIR must match between preparation and the server. Keep PDFs and SQLite inside backend-owned paths; never read sibling data at runtime.

- Comparison UI uses `/comparison/*` custom Python routes, OpenAI-format stored messages and AG-UI SSE. Only server-owned history is replayed. Test partial/cancelled runs and thread CRUD when changing this boundary.
- frontend uses npm/package-lock.json only. `npm run test:smoke` now tests real document comparisons and retains its verified demo thread.
