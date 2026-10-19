# DOC-001 문서 비교 이관용 독립 복사본 준비

- 날짜: 2026-10-18
- 맥락: 기존 `6-langgraph-platform-to-py`를 보존하면서 문서 비교 기능을 Python LangGraph로 이관할 별도 작업 공간을 요청받았다.
- 변경: `6-2-langgraph-platform-to-py-document`에 소스, 잠금 파일, 문서, 자산을 복사했다. 가상환경, node_modules, 빌드/캐시, 서버 상태, 검증 출력과 실제 환경 파일은 제외했다. 복사된 과거 Report/flow는 원본 프로젝트의 이력이다.
- 실행 경계: 백엔드 2035, 프런트엔드 3043으로 README, AGENTS, stock, package scripts, HTTP 기본 URL, smoke URL과 환경 예제를 맞췄다. 기존 서버를 종료하거나 새 서버를 상시 실행하지 않았다.
- 근거: 복사한 가상환경은 이전 절대 경로를 포함할 수 있으므로 새 위치에서 `uv sync --frozen`, `npm ci`로 설치했다. 패키지 버전과 잠금 파일은 유지했다.
- Stock: business.md 및 system.md의 DOC-001에 현재 구현과 후속 목표를 구분하고 포트를 동기화했다.
- 검증: backend `uv run pytest` 13개 PASS, `uv run ruff check agent tests` PASS. frontend `npm run lint`, `npm run typecheck`, `npm run verify` 모두 PASS.
- 설치 결과: npm ci에서 13개 취약점(5 low, 7 high, 1 critical)을 보고했다. 복사 단계에서는 의존성 업그레이드를 수행하지 않았다.
- 미실행: 실제 provider 호출, HTTP 서버 및 브라우저 통합 검증. 실제 .env는 복사하지 않았으며 실행 전 backend OPENAI_API_KEY 설정이 필요하다.
- 후속: document-comparison의 PDF 준비, 임베딩/검색, 문서 API, 비교 프롬프트/UI, 대화 영구 저장을 새 프로젝트에서 구현한다. 현재는 기존 mock 도구 기능이다.
