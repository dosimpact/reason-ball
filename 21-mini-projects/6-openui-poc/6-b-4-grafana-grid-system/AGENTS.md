# Python LangGraph + Next.js example

Read `docs/stock/business.md` and `docs/stock/system.md` before material changes; append dated decisions and evidence under `docs/flow/` and synchronize stock.

- `backend-langgraph/` is an independent Python 3.12/uv project. Run `uv sync --frozen`, `uv run pytest`, `uv run ruff check agent tests` from that directory. Start with `uv run langgraph dev --port 2041 --no-browser`.
- `frontend/` is an independent Next.js/npm project. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run verify` from that directory. `npm run dev` uses port 3049.
- Keep runtime, manifests, locks, environment files and tests inside their owning project. Connect only over HTTP; do not add runtime imports or filesystem reads across the two projects.
- Backend owns OPENAI_API_KEY. Frontend owns LANGGRAPH_API_URL / LANGGRAPH_ASSISTANT_ID and optional deployment authentication. Never print or commit real credentials.
- The backend prompt is a packaged asset. Updating the frontend component contract requires explicitly exporting and updating that asset, followed by integration verification.
- `npm run test:smoke` inside frontend makes real provider calls against running servers. Preserve unrelated servers, especially the sibling JS example on 2024; stop only task-owned processes.

This is the independent 6-7 SEC research dashboard, bootstrapped from 6-5. Preserve both 6-2 and 6-3 source projects. Preserve the sibling `6-langgraph-platform-to-py` project. Current functionality is the document-comparison UI backed by Python PDF preparation, search_documents, dynamic comparison prompts and durable SQLite conversations. Mock tools remain only as reference code/tests. Ports: backend 2041, frontend 3049. Treat inherited flow records as source-project history.

- Document preparation: `uv run prepare-documents` in backend-langgraph. Use `--no-samples` for local PDFs only. DOCUMENT_DATA_DIR must match between preparation and the server. Keep PDFs and SQLite inside backend-owned paths; never read sibling data at runtime.

- Comparison UI uses `/comparison/*` custom Python routes, OpenAI-format stored messages and AG-UI SSE. Only server-owned history is replayed. Test partial/cancelled runs and thread CRUD when changing this boundary.
- frontend uses npm/package-lock.json only. `npm run test:smoke` now tests real document comparisons and retains its verified demo thread.

- Integration: preserve all 6-2 names and signatures. Only extend Card children additively. Consult docs/stock/library-merge.md before altering registrations.
- Frontend uses npm; npm test runs contract/function/gallery tests. npm run test:e2e owns isolated Chrome contexts and (unless E2E_EXTERNAL_SERVERS=1) servers on 2041/3049. Close task-owned browsers after validation.
- Backend .env preserves the source credentials; agent/settings.py also reads the root .env without exposing it to the browser. Do not change credentials or point runtime storage at sibling projects.

- To retain all current annual and quarterly review documents, run `uv run prepare-documents --include-history --include-quarterly`. Preparation rebuilds the selected PDF index; omit neither flag when preserving the five-document review catalog. Official IR PDF preparation is distinct from SEC API collection.
