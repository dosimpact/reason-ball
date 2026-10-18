# Python LangGraph + DuckDB backend

Python 3.12/uv 독립 프로젝트다. 모델 키는 이 디렉터리의 `.env`에서만 읽는다.

```bash
uv sync --frozen
# 최초 설정 시에만 cp .env.example .env
uv run langgraph dev --port 2037 --no-browser
```

API는 http://127.0.0.1:2037, 문서는 `/docs`다. 원래 `agent/graph.py`의 DeepAgents/OpenUI/AG-UI 경로와 mock 날씨·주가·검색 도구를 유지한다. `agent/api.py`의 Starlette 앱은 같은 서버에 `/canvas/chat`, `/canvas/query`, `/canvas/health`를 추가한다. Canvas 그래프는 `agent/canvas_graph.py`의 plan→execute다.

## 분석 데이터

`agent/analysis.py`가 schema·SQL AST 검증·파라미터·등록·조회 서비스를 제공한다. `agent/query_worker.py`는 제한된 subprocess에서 read-only DuckDB 조회를 수행한다. 원천 날짜/지역 필터를 적용한 TEMP 사실 테이블과 월별 집계 view로 부분 월과 JOIN 중복을 방지한다. 지원 SQL, 제한, 데이터 단위는 [시스템 설계](../docs/stock/system.md)에 정리했다.

```bash
uv run python -m agent.fixtures seed
uv run python -m agent.fixtures correct --delta 1000
```

`correct`는 최신 날짜 KR 매출을 정정하고 원천 revision을 증가시킨다. 관리용 CLI이며 모델·HTTP에 쓰기 도구를 공개하지 않는다. 테스트 시 `CANVAS_DATA_DIR`과 `ANALYSIS_TODAY=2026-10-18`을 사용할 수 있다. 기본 runtime 디렉터리는 Git 제외이며 재시작 후 queryId를 해석하기 위해 보존해야 한다.

`POST /canvas/query`에는 등록된 queryId/queryVersion/parameters와 requestId/definitionRevision을 보낸다. SQL을 받지 않으며 모델 호출 없이 snapshot을 반환한다. `GET /canvas/health`의 modelCalls/queryRuns는 프로세스 내 진단 카운터로 재시작 시 초기화된다.

## 검증과 패키징

```bash
uv run pytest -q
uv run ruff check agent tests
uv build
```

단위 테스트는 임시 DB와 고정 날짜를 사용하며 실제 키가 필요 없다. HTTP/브라우저 통합 검사는 frontend에서 실행한다. `tests/make_browser_fixture.py`는 테스트에 쓸 실제 등록 조회와 snapshot JSON을 생성하며 비밀정보는 포함하지 않는다.

`agent/system-prompt.txt`와 `agent/canvas-prompt.txt`는 패키지에 포함한 자산이다. frontend 카탈로그 변경 시 명시적으로 다시 생성·동기화하고 Python 서버를 재시작한다. 서버 실행 중 frontend 파일을 읽거나 Node를 호출하지 않는다.

현재 실행은 로컬 개발 서버이며 인증·공개 배포·다중 사용자 운영은 포함하지 않는다. 기존 `.env`를 덮어쓰거나 키를 출력하지 않는다.
