# Python LangGraph + Next.js example

Read `docs/stock/business.md` and `docs/stock/system.md` before material changes; append dated decisions and evidence under `docs/flow/` and synchronize stock.

- `backend-langgraph/` is an independent Python 3.12/uv project. Run `uv sync --frozen`, `uv run pytest`, `uv run ruff check agent tests` from that directory. Start with `uv run langgraph dev --port 2037 --no-browser`.
- `frontend/` is an independent Next.js/npm project. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run verify` from that directory. `npm run dev` uses port 3045.
- Keep runtime, manifests, locks, environment files and tests inside their owning project. Connect only over HTTP; do not add runtime imports or filesystem reads across the two projects.
- Backend owns OPENAI_API_KEY. Frontend owns LANGGRAPH_API_URL / LANGGRAPH_ASSISTANT_ID and optional deployment authentication. Never print or commit real credentials.
- The backend prompt is a packaged asset. Updating the frontend component contract requires explicitly exporting and updating that asset, followed by integration verification.
- `npm run test:smoke` inside frontend makes real provider calls against running servers. Preserve unrelated servers, especially the sibling JS example on 2024; stop only task-owned processes.

This is the independent Chat + Canvas Python workspace. Preserve siblings 6, 6-2 and open-intelligent-ui. Ports 2037/3045. Use npm/package-lock.json only in frontend. Run npm run generate before typecheck/test/build after a clean install, then explicitly sync the generated prompt to Python. src/shared/ui/openui and src/pages/gallery/preview originate from open-intelligent-ui; preserve their source unless the task requires a change. LocalStorage is the chat persistence layer. Historical copied flow records describe the source project.

Frontend uses FSD: root app/ contains Next route adapters; src/app, src/pages, src/features, src/entities, src/shared contain implementation. Keep slice public APIs and downward imports. Run npm run lint:fsd and npm run verify. Generated catalogs live in frontend/generated/; npm run generate reads src/app/config/library.ts. Sync generated/system-prompt.txt to backend-langgraph/agent/system-prompt.txt explicitly after catalog changes.

Canvas uses react-grid-layout for 24-column coordinate placement. Keep grid transforms in entities/analysis/model/grid.ts and layout normalization in features/manage-canvas/model/layout.ts. Persist affected tab layouts atomically; viewport projections must not overwrite desktop coordinates.
