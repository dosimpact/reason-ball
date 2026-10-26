# Python LangGraph + Next.js example

Read `docs/stock/business.md` and `docs/stock/system.md` before material changes; append dated decisions and evidence under `docs/flow/` and synchronize stock.

- `backend-langgraph/` is an independent Python 3.12/uv project. Run `uv sync --frozen`, `uv run pytest`, `uv run ruff check agent tests` from that directory. Start with `uv run langgraph dev --port 2036 --no-browser`.
- `frontend/` is an independent Next.js/npm project. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run verify` from that directory. `npm run dev` uses port 3044.
- Keep runtime, manifests, locks, environment files and tests inside their owning project. Connect only over HTTP; do not add runtime imports or filesystem reads across the two projects.
- Backend owns OPENAI_API_KEY. Frontend owns LANGGRAPH_API_URL / LANGGRAPH_ASSISTANT_ID and optional deployment authentication. Never print or commit real credentials.
- The backend prompt is a packaged asset. Updating the frontend component contract requires explicitly exporting and updating that asset, followed by integration verification.
- `npm run test:smoke` inside frontend makes real provider calls against running servers. Preserve unrelated servers, especially the sibling JS example on 2024; stop only task-owned processes.

This is the independent Intelligent UI Python copy. Preserve siblings 6, 6-2 and open-intelligent-ui. Ports 2036/3044. Use npm/package-lock.json only in frontend. Run npm run generate before typecheck/test/build after a clean install, then explicitly sync the generated prompt to Python. src/lib and gallery/preview originate from open-intelligent-ui; preserve their source unless the task requires a change. LocalStorage is the chat persistence layer. Historical copied flow records describe the source project.


Report input, source-derived programs and generation validation live in `frontend/src/reporting/`; preserve the copied `src/lib` catalog. Compose prompts through `frontend/src/library.ts`, sync the backend asset, and restart Python after prompt changes. `npm run test:e2e:reports` uses installed Google Chrome and running 2036/3044 for general intent/report UI tests. Files under `docs/vendors/` are standalone sample documents; runtime, automated tests and batch tools must not depend on reading them. Label AI commentary separately from source-derived numbers.

검증 완료 후 작업자가 연 테스트 Chrome 창·탭과 전달용 추가 탭을 정리한다. 기존 사용자 탭·localStorage 기록·요청된 실행 서버는 보존한다.

일반/보고서 프롬프트는 `frontend/src/library.ts`와 `src/reporting/report-library.ts`에서 각각 생성한다. 두 생성 자산을 Python의 `system-prompt.txt`/`report-system-prompt.txt`에 동기화하고 서버를 재시작한다. 의도 분류는 Python `intent` graph가 소유하며 프런트엔드에서 키워드 라우팅이나 OpenAI 직접 호출을 추가하지 않는다.
