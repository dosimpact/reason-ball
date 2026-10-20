# Lite Canvas LangGraph 백엔드

```bash
uv sync --frozen
uv run langgraph dev --port 2040 --no-browser
```

API: http://127.0.0.1:2040 / 문서: http://127.0.0.1:2040/docs

`.env`에 OPENAI_API_KEY를 둔다. `OPENAI_MODEL`은 메인/질문 모델(기본 gpt-4.1-mini), `OPENAI_REPORT_MODEL`은 리포트 생성/검토 모델(기본 gpt-5.4)이다. 검증 URL은 `OPENUI_VALIDATOR_URL`(기본 http://127.0.0.1:3048/api/program/validate).

메인 StateGraph가 LLM 의도 판단 후 compiled report subgraph로 라우팅한다. subgraph가 Canvas open과 OpenUI delta를 발행하고, 파서 및 원문 검토 후 저장한다. 질문에는 checkpoint의 report/원문/quote 문맥을 사용한다.

`agent/data/vendors`가 원문 카탈로그이며 `.data/reports.sqlite3`에 현재/발행 리포트를 저장한다. `REPORT_DB_PATH`로 저장 경로를 분리할 수 있다. 사용자에게 반환하는 report에서 원문과 thread ID는 제외한다.

```bash
uv run pytest
uv run ruff check agent tests
```

[시스템 설계](../docs/stock/system.md)
