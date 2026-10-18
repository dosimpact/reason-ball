# 시스템 설계

## PY-005~007 프로젝트 경계

- `backend-langgraph/`: Python 코드, uv manifest/lock, LangGraph 설정, Python 테스트, 자체 `.env`, 런타임 데이터, 프롬프트 자산.
- `frontend/`: Next.js 소스, npm/pnpm manifest/lock, 자체 `.env`, Node 검사와 HTTP 통합 테스트, 브라우저 산출물.
- 루트: README, AGENTS, 통합 stock/flow 문서만 둔다. 루트 실행 스크립트나 공유 node_modules/venv는 없다.
- 다른 프로젝트 폴더를 실행 중 읽거나 import하지 않는다. HTTP의 AG-UI / LangGraph protocol 계약만 공유한다.

## PY-002 통신과 이벤트

브라우저의 `fetchLLM`/`agUIAdapter` → frontend의 `/api/chat` → Python LangGraph API의 protocol v2 경로로 연결한다. 기존 `@openuidev/langchain` 프록시는 메시지 변환, 불완전한 tool history 제거, 임시 thread 생성·삭제, 실행 수명주기 및 취소 처리를 담당한다. 주소는 frontend의 LANGGRAPH_API_URL로 설정한다.

`backend-langgraph/agent/graph.py`가 Python DeepAgents 그래프와 `stream_transformers()`를 노출한다. LangGraph API가 실행마다 `OpenUIStreamTransformer`를 생성한다. root 변환기가 모든 namespace를 처리하고 하위 scope에서는 중복 방출하지 않는다. `(payload, metadata)` 메시지 이벤트를 namespace + model run_id로 분리한다. 사용자 메시지는 응답으로 다시 보내지 않는다.

TEXT_MESSAGE_START/CONTENT/END, TOOL_CALL_START/ARGS/END/RESULT, RUN_ERROR를 `StreamChannel("openui")`로 내보낸다. 도구 인자 누적 snapshot은 새 suffix만 전달하고, Python ToolMessage.content를 추출하며, built-in Command/Pydantic 결과도 직렬화한다. 도구 결과와 종료 이벤트는 중복 제거한다. RUN_STARTED/FINISHED는 기존 프록시가 처리한다.

변환기 범위는 Chat Completions의 텍스트·함수 도구 호출이다. provider 실행 도구/Responses API 전용 이벤트는 사용하지 않는다.

## PY-003 의존성

- Python 3.12, deepagents 0.7.28, langgraph 1.2.16, langgraph-api 0.16.1, langchain-openai 1.7.2. `backend-langgraph/pyproject.toml` 및 `uv.lock`으로 관리한다. setuptools 패키징에 프롬프트를 포함하며 `uv build`로 독립 sdist/wheel을 생성한다.
- Next.js 16.1.6 / React 19.2.3 / OpenUI UI·프록시 패키지는 frontend에 유지한다. JS 에이전트 및 JS LangGraph CLI 직접 의존성은 제거한다.
- 각 프로젝트의 환경 파일, 의존성 폴더, 캐시, 런타임 상태, 검증 산출물은 각 .gitignore에서 제외한다.

## PY-008 OpenUI 프롬프트 자산

`backend-langgraph/agent/system-prompt.txt`를 코드와 함께 버전 관리한다. `graph.py`는 자기 파일 기준으로만 읽는다. 백엔드는 Node/OpenUI CLI나 frontend 파일을 참조하지 않는다.

컴포넌트 계약 변경 시 frontend에서 `npm run generate`로 `src/generated/system-prompt.txt`와 명세를 생성한다. 개발자가 결과물을 백엔드 자산에 명시적으로 반영한다. 이 자산 교환은 설치·실행 시 자동으로 수행하지 않는다. 백엔드 파일을 독립 배포해도 프롬프트가 포함된다.

## 실행

별도 터미널에서 각각 실행한다.

```bash
cd backend-langgraph
uv sync --frozen
uv run langgraph dev --port 2034 --no-browser
```

```bash
cd frontend
npm ci
npm run dev
```

frontend는 3042 포트이며 LANGGRAPH_API_URL 기본값은 http://127.0.0.1:2034다. backend의 .env는 OPENAI_API_KEY/OPENAI_MODEL을 소유한다. frontend는 LANGGRAPH_API_URL/LANGGRAPH_ASSISTANT_ID 및 선택적인 배포 인증 LANGSMITH_API_KEY를 소유한다. 기존 형제 JS 예제의 2024 서버와 독립 실행한다.

## 검증

- backend: `uv run pytest` (13개), `uv run ruff check agent tests`.
- frontend: `npm run lint`, `npm run typecheck`, `npm run verify`.
- frontend: `npm run test:smoke`는 실행 중인 두 서버를 통해 실제 모델·도구·스트림·후속 대화·400 오류를 검증한다. API 호출 비용이 발생한다.
- 브라우저: 도구 상태 표시, 카드 렌더링, 여러 도구 호출과 대화 이력 유지.

최종 결과는 [프로젝트 분리 기록](../flow/2026-10-18-project-split.md)을 참조한다. Cloud 배포는 수행하지 않는다.

## PY-009 OpenUI 모드의 텍스트와 Markdown

현재 프롬프트는 응답의 외부 문법을 OpenUI Lang으로 지시한다. 화면에 표시할 일반 설명과 Markdown은 TextContent 및 MarkDownRenderer의 문자열에 담는다. 따라서 Markdown 표시를 위해 inlineMode 전환이 필수인 것은 아니다. TextContent도 Markdown을 해석하므로 문법 기호까지 원문 그대로 표시하는 요구는 별도 처리한다. 상세 예시는 Report.md의 해당 질문 항목을 참고한다. 실행 모드나 프롬프트 자산은 변경하지 않았다.

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

### 기본 데모를 읽는 순서

page.tsx의 채팅 화면 → api/chat/route.ts의 LangChain 프록시 → graph.py의 Python 모델/도구 실행 → streaming.py의 이벤트 변환 순서로 읽는다. tools.py는 실제 외부 API가 아닌 mock JSON 데이터를 반환한다.
