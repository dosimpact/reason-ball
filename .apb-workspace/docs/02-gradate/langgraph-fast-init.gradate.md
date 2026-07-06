# langgraph-fast-init Gradate

## Design

`20-portfolio/1-reason-hwang/3-langgraph-fast/` 아래에 독립적인 `uv` 기반 Python 패키지를 둔다.
패키지는 `src/langgraph_fast/` 레이아웃을 사용하고, HTTP 진입점과 LangGraph 실행 로직을 분리한다.

- FastAPI 진입점은 `langgraph_fast.server.server:app`이며 `GET /health`, `POST /graph/run`을 제공한다.
- LangGraph 실행은 `graph/workflow.py`가 담당하고, 상태 스키마는 `graph/state.py`에 둔다.
- 메인 그래프와 서브에이전트 영역은 `graph/main/`과 `graph/subagents/` 아래에 같은 `node`, `mcp`, `prompts`, `tools` 디렉터리 패턴을 가진다.
- LLM provider는 `graph/shared/provider/` 아래에 둔다. 기본 OpenAI provider와 `chatgpt-oauth-proxy` provider를 같은 `complete(message)` 인터페이스로 제공한다.
- 네트워크 provider 호출은 실제 그래프 실행 시점에만 수행되게 해서 헬스 체크와 기본 라우트 테스트가 API 키 없이도 실행 가능하도록 한다.
- 테스트는 FastAPI 앱의 공개 HTTP 인터페이스를 우선 검증한다.

## Implementation Draft

### Architecture Overview

새 프로젝트는 `uv` 패키지로 구성된다. `pyproject.toml`은 런타임 의존성
`fastapi`, `uvicorn`, `langgraph`, `openai`, `httpx`, `pydantic`과 dev 의존성
`pytest`를 선언한다. `README.md`는 `uv sync`, `uv run uvicorn ...` 실행 방법과
기본 API 사용 예시를 제공한다.

FastAPI 라우터는 요청 모델을 검증한 뒤 `run_graph()`를 호출한다. `run_graph()`는
매 요청마다 최소 LangGraph 앱을 빌드하고 `GraphState`를 `ainvoke`한다. 현재 그래프는
`START -> call_llm -> END` 단일 노드 흐름이며, 이후 노드/도구를 `graph/main/`과
`graph/subagents/` 패턴에 맞춰 확장할 수 있다.

### Modules

- `pyproject.toml`: `uv` 프로젝트 메타데이터, 의존성, pytest 설정.
- `.python-version`: 로컬 Python 버전 힌트.
- `README.md`: 설치, 실행, API 호출 방법.
- `src/langgraph_fast/server/server.py`: FastAPI 앱, 요청/응답 모델, HTTP 엔드포인트.
- `src/langgraph_fast/graph/state.py`: LangGraph 공유 상태 타입.
- `src/langgraph_fast/graph/workflow.py`: 그래프 빌드 및 실행 함수.
- `src/langgraph_fast/graph/main/node/llm.py`: provider를 선택하고 LLM을 호출하는 그래프 노드.
- `src/langgraph_fast/graph/shared/provider/openai.py`: OpenAI Responses API 기반 provider.
- `src/langgraph_fast/graph/shared/provider/chatgpt_oauth_proxy.py`: OpenAI 호환 `/v1/chat/completions` proxy provider.
- `src/langgraph_fast/graph/main/{node,mcp,prompts,tools}/`: 메인 그래프 확장 위치.
- `src/langgraph_fast/graph/subagents/{node,mcp,prompts,tools}/`: 서브에이전트 확장 위치.
- `tests/test_app.py`: 공개 HTTP 엔드포인트 기본 동작 테스트.

### Interfaces

- `GET /health -> {"status": "ok"}`.
- `POST /graph/run` 요청:
  - `message: str`
  - `provider: str = "openai"`
- `POST /graph/run` 응답:
  - `provider: str`
  - `message: str`
  - `response: str`
- 로컬 실행 명령:
  - `uv sync`
  - `uv run uvicorn langgraph_fast.server.server:app --reload`
- provider 내부 인터페이스:
  - `complete(message: str) -> str`

### Dependencies

- Runtime: `fastapi`, `uvicorn[standard]`, `langgraph`, `openai`, `httpx`, `pydantic`.
- Dev: `pytest`.
- External runtime settings:
  - OpenAI provider: `OPENAI_API_KEY`, optional `OPENAI_MODEL`.
  - chatgpt-oauth-proxy provider: optional `CHATGPT_OAUTH_PROXY_URL`, optional `CHATGPT_OAUTH_PROXY_MODEL`.
  - Default proxy URL: `http://127.0.0.1:8787`.

### Data Flow

1. Client sends `POST /graph/run` with `message` and optional `provider`.
2. FastAPI validates the request with `GraphRunRequest`.
3. `run_graph()` builds a compiled LangGraph workflow.
4. Initial `GraphState` carries `message`, selected `provider`, and empty `response`.
5. `call_llm` resolves the provider through `get_provider()`.
6. Provider sends the LLM request to OpenAI or the local OAuth proxy.
7. Node returns `{"response": ...}` and LangGraph merges it into final state.
8. FastAPI returns `GraphRunResponse`.

## Gap Analysis (Pre-Validate)

| Design Item | Implementation Evidence | Status |
| --- | --- | --- |
| `uv` project metadata exists | `20-portfolio/1-reason-hwang/3-langgraph-fast/pyproject.toml`, `uv.lock`, `.python-version` | Done |
| FastAPI entrypoint in `server/server.py` | `src/langgraph_fast/server/server.py` defines `app`, `/health`, `/graph/run` | Done |
| LangGraph workflow is callable from API | `server.py` calls `run_graph`; `workflow.py` compiles and invokes `StateGraph` | Done |
| Shared graph state exists | `src/langgraph_fast/graph/state.py` defines `GraphState` | Done |
| Main graph role directories exist | `graph/main/node`, `mcp`, `prompts`, `tools` packages | Done |
| Subagent role directories exist | `graph/subagents/node`, `mcp`, `prompts`, `tools` packages | Done |
| OpenAI provider exists | `graph/shared/provider/openai.py` implements `OpenAIProvider.complete()` | Done |
| chatgpt-oauth-proxy provider exists | `graph/shared/provider/chatgpt_oauth_proxy.py` implements proxy chat completions call | Done |
| Basic API tests exist and pass | `tests/test_app.py`; `uv run pytest` passed 2 tests | Done |
| Gap target below 1% | 9 of 9 design items implemented | Done |

## Implementation Notes

- `uv sync` completed and installed runtime/dev dependencies into the local `.venv`.
- `uv run pytest` completed with 2 passing tests. FastAPI emitted a dependency deprecation warning from `starlette.testclient`, but it does not fail the current validation.
- The OpenAI and proxy paths are intentionally not called in unit tests because they require external credentials/services; validate phase should exercise them when the required services are available.
