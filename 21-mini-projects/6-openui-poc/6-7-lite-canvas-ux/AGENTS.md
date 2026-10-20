# Lite Canvas UX — 6-7 작업 지침

작업 범위는 이 디렉터리다. 6-3과 다른 형제 프로젝트를 변경하지 않는다. `goal.md`는 사용자가 작성한 요구사항이므로 보존한다.

먼저 `docs/stock/business.md`, `docs/stock/system.md`를 읽고, 중요 변경은 `docs/flow/`에 날짜별로 추가한 뒤 stock에 현재 상태를 반영한다.

- 백엔드: Python 3.12/uv, `uv sync --frozen`, `uv run pytest`, `uv run ruff check agent tests`. 실행 `uv run langgraph dev --port 2040 --no-browser`.
- 프런트엔드: Next.js/npm, `npm ci`, `npm run generate`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run verify`. `npm run dev`는 3048.
- `npm run test:e2e`는 실제 provider를 호출하는 Chrome E2E다. 기본적으로 테스트 소유 서버를 시작/종료한다. 이미 실행한 이 프로젝트 서버만 사용할 때 `CANVAS_USE_RUNNING_SERVER=1`을 지정한다.
- 두 프로젝트는 HTTP로만 연결한다. 원문은 backend `agent/data/vendors`에 패키징한다. 형제 프로젝트 또는 frontend 파일을 backend 런타임에서 읽지 않는다.
- backend만 `OPENAI_API_KEY`를 소유한다. `.env` 내용을 출력/커밋하지 않는다. 모델은 `OPENAI_MODEL`과 `OPENAI_REPORT_MODEL`로 설정한다.
- UI 계약 변경 후 `npm run generate`를 실행하고 생성된 system-prompt.txt를 backend `agent/system-prompt.txt`로 복사·비교한 뒤 backend를 재시작한다.
- thread당 하나의 report, 서버 생성 report ID, 오래된 event/quote 거부, 미발행 report 공개 조회 금지를 유지한다.
- `.data`, `.langgraph_api`, node_modules, .venv, .next, output과 테스트 결과는 Git 제외다. 소유하지 않은 서버/브라우저는 종료하지 않는다.
- 복사된 과거 flow는 원본 이력이다. 현재 동작·검증은 6-7 stock과 새 flow를 따른다.
