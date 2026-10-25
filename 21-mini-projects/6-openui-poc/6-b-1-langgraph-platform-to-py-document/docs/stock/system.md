# 시스템 설계

## PY-005~007 프로젝트 경계

- backend-langgraph: Python 3.12/uv, LangGraph/DeepAgents, OpenAI, PDF/SQLite, 테스트, 프롬프트 자산, 자체 .env.
- frontend: Next.js/React/OpenUI, UI 카탈로그, 생성 명령, HTTP 프록시, npm/package-lock.json, 자체 환경. 이 프로젝트는 npm으로 관리하며 복사되어 남은 pnpm-lock은 제거했다.
- 실행 중 다른 프로젝트 파일을 읽거나 import하지 않는다. 설치/빌드도 독립적이다.

## PY-002 통신과 이벤트

Browser AgentInterface → frontend /api/chat → Python /comparison/chat → Python DeepAgents/LangGraph graph.

브라우저 요청/저장 형식은 openAIMessageFormat, 응답 스트림은 agUIAdapter다. Next.js는 HTTP만 중계한다. Python custom Starlette app은 langgraph.json의 http.app으로 같은 2035 서버에 탑재한다. 요청마다 현재 문서 목록으로 build_graph를 구성하고, astream_events(version="v3", transformers=[OpenUIStreamTransformer])로 실행한다. 버전을 잠근 실험적 v3 API이므로 의존성 갱신 시 회귀 검증이 필요하다.

기존 스트림 변환기는 TEXT_MESSAGE/TOOL_CALL 이벤트를 생성한다. HTTP facade가 RUN_STARTED, RUN_FINISHED와 실패 처리를 맡는다. 저장 완료 후 RUN_FINISHED를 보낸다. 클라이언트 연결 취소는 그래프 async context를 종료하며 부분 이력 저장을 cancellation shield로 보호한다. 동일 thread의 동시 요청·변경·삭제는 active set으로 차단한다(단일 프로세스 범위).

기존 native agent 그래프 엔드포인트는 유지하지만, 비교 UI의 대화 저장과 동적 문서 목록은 /comparison 경로를 통해 제공한다. 과거 JS createLangChainStreamResponse의 임시 thread 방식은 비교 UI에서 사용하지 않는다.

## DOC-002 PDF 준비 및 검색

- CLI `uv run prepare-documents`: 샘플 다운로드/캐시 및 로컬 PDF, pypdf 텍스트 레이어 추출, 페이지별 1200자/200자 overlap, 80자 초과 구절, 100개 단위 임베딩.
- --no-samples / --documents-dir / --data-dir 지원. 기본 backend/data, DOCUMENT_DATA_DIR로 변경. CLI와 서버는 동일 경로 사용.
- text-embedding-3-small 벡터를 float32 little-endian BLOB으로 documents.sqlite에 저장. 모델/차원 메타데이터 검증. 완성한 임시 DB를 원자적으로 교체하여 실패 시 기존 DB 보존.
- search_documents: query 3~300자, document_ids 최대 10개(빈 배열은 전체), passages_per_document 1~4. 문서별 내적 순위, found >= 0.3, page/text/score/url 반환. 준비되지 않은 DB/알 수 없는 ID/provider 실패는 오류로 구분.
- DB 읽기와 파일 접근은 asyncio.to_thread로 이벤트 루프 밖에서 수행한다. 검색은 전체 벡터 선형 검색이며 원본 mtime 메모리 캐시는 도입하지 않았다.
- Node unpdf와 Python pypdf의 추출 결과가 완전히 같다는 보장은 없다. 샘플 준비 결과 3문서/396페이지/1564구절.

## DOC-003 비교 UI와 프롬프트

frontend/src/library.ts는 openuiChatLibrary와 comparison-prompt.ts의 비교 규칙/예시를 export한다. `npm run generate` 후 결과를 backend-langgraph/agent/system-prompt.txt로 명시적으로 복사한다. Python은 기본 자산 + 현재 문서 목록 + 검색/근거 규칙을 결합한다. 카탈로그와 자산의 일치는 cmp로 검증한다.

UI: comparison-chat.tsx, document-library.tsx, theme.ts, globals.css. OpenUI styles를 포함한다. 문서 목록과 thread CRUD는 frontend route → Python /comparison/documents 및 /comparison/threads로 전달된다. 원본의 추천 질문/테마/출처 카드/차트/표/후속 질문을 유지한다.

## DOC-004 영구 대화 저장과 신뢰 경계

agent/history.py의 conversations.sqlite에 id/title/created_at/messages JSON을 저장한다. DB 연결은 매 작업 후 닫고 트랜잭션으로 기록한다. 요청의 과거 system/assistant/tool 메시지를 신뢰하지 않고 마지막 user 텍스트만 사용한다. 정상 실행은 최종 LangChain 메시지를 OpenAI 형식으로 저장하며 실패/중단은 TurnRecorder로 수집한 부분 이력을 저장한다. 다음 실행에서 미완성 tool call과 orphan result를 제거한다.

GET /comparison/threads/get, GET .../get/{id}, POST .../create, PATCH .../update/{id}, DELETE .../delete/{id}. UUID와 입력 형식 검증, 없는 thread 404, 중복 실행 409. Next.js는 외부 origin 변경 요청을 차단한다. 로컬 사용 전제이며 사용자 인증/멀티프로세스 잠금은 구현하지 않았다.

## 실행 및 검증

backend: `uv sync --frozen`, `uv run prepare-documents`, `uv run langgraph dev --port 2035 --no-browser`.
frontend: `npm ci`, `npm run dev` 또는 `npm run verify` 후 `npm start`(127.0.0.1:3043).

backend: `uv run pytest` 39개, `uv run ruff check agent tests`, `uv build`.
frontend: `npm run lint`, `npm run typecheck`, `npm run verify`, 서버 실행 상태에서 `npm run test:smoke`(실제 provider 비용).

검증 증거: [전체 기능 이관 기록](../flow/2026-10-18-document-comparison-complete.md). 이전 flow/Report는 당시 상태의 이력이며 현재 설계는 이 문서를 따른다.

## CODE-001 한국어 주석과 코드 읽기 안내

직접 관리하는 Python/TypeScript/TSX/JS/CSS 소스, 테스트와 주석 가능한 설정에는 파일 역할과 주요 처리 경계를 한국어 주석으로 설명한다. 모델에 전달하는 tool docstring·프롬프트 문자열은 실행 계약이므로 주석 번역 대상으로 취급하지 않는다. 의존성, 생성물, 실제 .env, PDF/SQLite, 잠금 파일과 과거 flow 기록은 수정하지 않는다.

| 읽을 위치 | 큰 틀에서의 역할 |
| --- | --- |
| backend-langgraph/agent/graph.py | 모델·도구·OpenUI 프롬프트를 결합하는 에이전트 구성 |
| backend-langgraph/agent/streaming.py | 모델/도구 이벤트를 AG-UI 텍스트·도구 이벤트로 변환 |
| frontend/src/app/page.tsx, layout.tsx | 화면 진입점과 공통 레이아웃 |
| frontend/src/app/api/ | Python 백엔드로의 HTTP 연결 |
| frontend/src/library.ts | 렌더링 카탈로그와 프롬프트 생성의 연결점 |
| backend-langgraph/tests/, frontend/tests/ | 단위/계약 검사와 실제 provider를 쓰는 smoke 검증의 구분 |
| backend-langgraph/pyproject.toml | Python 의존성·검사·패키징 설정 |
| frontend/next.config.ts, eslint.config.mjs | 프런트엔드 빌드 경계와 정적 검사 설정 |

### 주석을 넣을 수 없는 설정과 생성 자산

- backend-langgraph/langgraph.json: Python 버전, 패키지 의존 경로, 그래프 이름과 진입점, 로컬 환경 파일을 선언한다.
- frontend/package.json: 설치 의존성과 dev/build/검증/프롬프트 생성 명령을 선언한다. 실제 설치 버전은 잠금 파일로 고정한다.
- frontend/tsconfig.json: TypeScript와 Next.js 타입 검사 범위 및 모듈 경로 설정이다.
- agent/system-prompt.txt와 frontend/src/generated/: UI 명세에서 생성하는 모델 입력이다. 개발용 주석을 삽입하면 모델 동작이 바뀔 수 있으므로 생성 진입점과 이 문서에서 설명한다.

위 JSON에는 비표준 주석 필드를 추가하지 않는다. 코드 실행 의미는 변경 전후 Python AST 및 주석 제거 후 JS/TS 출력 비교로 확인한다.

### 문서 비교 기능을 읽는 순서

1. prepare_documents.py: PDF 확보 → 페이지별 구절 분할 → 임베딩 → 새 DB 교체.
2. documents.py: 검색 인자 검증 → DB snapshot → 질문 임베딩 → 문서별 결과와 출처.
3. history.py: 대화 CRUD → 신뢰할 이력 정리 → 중단된 실행의 부분 기록.
4. app.py: 요청 검증 → 현재 문서/서버 이력 조회 → 그래프 스트림 → 저장 후 완료.
5. comparison-chat.tsx, document-library.tsx, lib/backend.ts: 비교 화면·문서 목록과 Python HTTP 연결.

이 프로젝트의 langgraph.json은 http.app으로 비교 API도 같은 서버에 탑재한다. comparison-prompt.ts의 문자열은 모델 지침이며 일반 코드 주석과 구분한다. tools.py의 mock 도구는 비교 그래프에 등록하지 않는다.
