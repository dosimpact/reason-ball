# langgraph-fast-init Plan

## Goal

`20-portfolio/1-reason-hwang/3-langgraph-fast/` 경로에 `uv` 기반 Python
프로젝트를 초기화하고, FastAPI + LangGraph 기본 구조와 실행 가능한 최소 코드를
구현한다.

## Scope

- 포함 범위:
  - `20-portfolio/1-reason-hwang/3-langgraph-fast/` 경로에서 `uv` 프로젝트를 초기화한다.
  - `server/server.py`를 FastAPI 엔트리포인트로 두는 파일 구조를 만든다.
  - LangGraph 구현을 `graph/main/`과 `graph/subagents/` 아래에 동일한 패턴의 `node`, `mcp`, `prompts`, `tools` 구조로 나눈다.
  - LLM 호출 예제를 포함하고, provider 구현은 `graph/shared/provider/` 아래에 둔다.
  - 우선 OpenAI provider를 기본 provider로 구현한다.
  - 두 번째 provider로 `/Users/studio/workspace/projects/chatgpt-oauth-proxy` proxy 서버 연동을 추가한다.
  - FastAPI 기본 애플리케이션 코드를 구현한다.
  - LangGraph 기본 그래프 코드를 구현하고 API에서 호출할 수 있게 연결한다.
- 제외 범위:
  - 운영 배포 설정.
  - 인증, 영속성, 관측성, 복잡한 LangGraph 플로우.
  - 별도 UI 또는 프론트엔드 작업.

## Directory Structure

```text
20-portfolio/1-reason-hwang/3-langgraph-fast/
├── pyproject.toml
├── README.md
├── .python-version
├── src/
│   └── langgraph_fast/
│       ├── __init__.py
│       ├── server/
│       │   ├── __init__.py
│       │   └── server.py
│       └── graph/
│           ├── __init__.py
│           ├── workflow.py
│           ├── state.py
│           ├── shared/
│           │   ├── __init__.py
│           │   └── provider/
│           │       ├── __init__.py
│           │       ├── openai.py
│           │       └── chatgpt_oauth_proxy.py
│           ├── main/
│           │   ├── __init__.py
│           │   ├── node/
│           │   │   └── __init__.py
│           │   ├── mcp/
│           │   │   └── __init__.py
│           │   ├── prompts/
│           │   │   └── __init__.py
│           │   └── tools/
│           │       └── __init__.py
│           └── subagents/
│               ├── __init__.py
│               ├── node/
│               │   └── __init__.py
│               ├── mcp/
│               │   └── __init__.py
│               ├── prompts/
│               │   └── __init__.py
│               └── tools/
│                   └── __init__.py
└── tests/
    ├── __init__.py
    └── test_app.py
```

- `server/server.py`: FastAPI 앱 생성, HTTP 엔드포인트 정의, LangGraph 실행 함수 호출.
- `graph/workflow.py`: LangGraph 기본 그래프 정의 및 실행 흐름 제공.
- `graph/state.py`: LangGraph에서 공유할 상태 타입 또는 상태 스키마 정의.
- `graph/shared/provider/openai.py`: OpenAI 기반 LLM 클라이언트 또는 호출 헬퍼 구현 위치.
- `graph/shared/provider/chatgpt_oauth_proxy.py`: `/Users/studio/workspace/projects/chatgpt-oauth-proxy`
  proxy 서버를 통한 LLM 호출 헬퍼 구현 위치.
- `graph/main/node/`: 메인 그래프 노드 구현 위치.
- `graph/main/mcp/`: 메인 그래프에서 사용할 MCP 연동 코드 위치.
- `graph/main/prompts/`: 메인 그래프 프롬프트 템플릿 또는 프롬프트 구성 코드 위치.
- `graph/main/tools/`: 메인 그래프 도구 함수 또는 도구 어댑터 위치.
- `graph/subagents/node/`: 서브에이전트 그래프 노드 구현 위치.
- `graph/subagents/mcp/`: 서브에이전트에서 사용할 MCP 연동 코드 위치.
- `graph/subagents/prompts/`: 서브에이전트 프롬프트 템플릿 또는 프롬프트 구성 코드 위치.
- `graph/subagents/tools/`: 서브에이전트 도구 함수 또는 도구 어댑터 위치.
- `tests/test_app.py`: 기본 API 동작 검증 테스트.

## Verification

- 구현 범위: Python 서비스 스켈레톤, 의존성 설정, `server/server.py` FastAPI 진입점,
  LangGraph 모듈, OpenAI provider 및 chatgpt-oauth-proxy provider 기반 LLM 호출 예제,
  최소 통합 라우트를 만든다.
- 공개 인터페이스: FastAPI HTTP 엔드포인트와 로컬 실행 명령.
- 외부 의존성: `uv`, FastAPI, LangGraph, OpenAI SDK 또는 LangChain OpenAI 연동 패키지,
  `/Users/studio/workspace/projects/chatgpt-oauth-proxy` proxy 서버,
  로컬 개발용 ASGI 서버 의존성.
- 내부 의존성: `20-portfolio/1-reason-hwang/3-langgraph-fast/` 아래의 프로젝트 패키지 모듈.
- 위험 영역: 의존성 호환성, Python 패키징 구조, import 경로, LangGraph 기본 코드의 실제 실행 가능성,
  OpenAI API 키 환경 변수 처리.

## Validation

- `uv` 프로젝트 메타데이터가 생성되고 필요한 의존성이 선언되어 있다.
- FastAPI 엔트리포인트는 `server/server.py`에 있고, LangGraph 코드는 `graph/main/`과 `graph/subagents/` 아래에 동일한 역할별 디렉터리 패턴으로 분리되어 있다.
- LLM 호출 provider는 `graph/shared/provider/` 아래에 있으며, OpenAI provider와
  chatgpt-oauth-proxy provider를 제공한다.
- FastAPI 앱이 기본 애플리케이션으로 정상 시작된다.
- 기본 엔드포인트가 LangGraph 기본 실행 경로를 호출하고, 그래프 내부에서 간단한 LLM 호출을 수행할 수 있다.

### E2E 시나리오

- Given `uv` 프로젝트가 초기화되어 있을 때, When 의존성을 설치하고 앱을 실행하면, Then FastAPI 서버가 정상 시작된다.
- Given FastAPI 서버가 실행 중이고 OpenAI API 키가 설정되어 있을 때, When 기본 그래프 실행 엔드포인트를 호출하면, Then LangGraph가 OpenAI provider를 통해 간단한 LLM 응답을 반환한다.
- Given chatgpt-oauth-proxy 서버가 실행 중일 때, When proxy provider를 선택해 기본 그래프 실행 엔드포인트를 호출하면, Then LangGraph가 proxy 서버를 통해 간단한 LLM 응답을 반환한다.

## Skills

### Gradate 단계

- TBD

### Validate 단계

- TBD
