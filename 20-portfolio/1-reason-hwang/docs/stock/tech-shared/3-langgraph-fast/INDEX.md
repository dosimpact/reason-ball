# 3-langgraph-fast 기술 문서 지도

이 디렉터리는 `3-langgraph-fast` 패키지가 소유하는 런타임·저장소 구현과 운영 계약을
설명한다. 공통 시스템 경계는 상위 [System design](../system-design.md), 10-K/10-Q 비즈니스
동작은 [US Corporate Filings](../../us-corporate-filings/INDEX.md)를 먼저 확인한다.

| 문서 | 책임 |
| --- | --- |
| [LangGraph DB Saver](3-langgraph-db-saver.md) | PostgreSQL application metadata, checkpoint saver, 전용 schema와 복구 정책 |
| [Graph DB](4-graph-db.md) | Neo4j 연결, schema 초기화, 10-K graph model, 쓰기·검색·운영 계약 |
| [A2UI](a2ui.md) | 생성 UI, 사용자 action, 모델 설정과 검증 |

두 저장소는 목적과 생명주기가 다르다.

- PostgreSQL `langgraph` schema: Assistant, thread, run과 실행 checkpoint.
- Neo4j `neo4j` database: 공시 문서에서 추출한 연결형 지식과 근거 검색 데이터.

- [SEC Intelligent UI](sec-intelligent-ui.md): A2UI 의존 없는 SEC 질의/근거/AG-UI 구현.

- [기술적 분석 Deep Agent](../../technical-analysis/system-design.md): Yahoo 일봉·주봉 도구, TA-Lib 시그널, 공통 OpenUI 출력 및 LangGraph runtime 등록.

## LG-ENV-PORT-001: 서버 포트 환경 변수

`3-langgraph-fast/.env`와 `.env.example`은 `SERVER_PORT=8000`을 선언한다.
현재 `dev`/`start`의 Uvicorn CLI는 이 변수를 포트 옵션에 연결하지 않으므로,
변수 값 변경만으로 수신 포트가 바뀌지 않는다. 실제 포트 지정은 `--port`를 사용한다.
`dev:langgraph`는 `uv run --env-file .env`로 환경 변수를 로드한 뒤
`LANGGRAPH_PORT`를 `langgraph dev --port`에 전달한다. `.env`와 `.env.example`의
기본값은 `LANGGRAPH_PORT=2025`이며, 미설정 시에도 2025를 사용한다.
셸에서 전달한 환경 변수가 `.env`보다 우선하고, 명시적인 CLI `--port`가 최종 우선한다.
`langgraph.json`은 변경하지 않는다.
