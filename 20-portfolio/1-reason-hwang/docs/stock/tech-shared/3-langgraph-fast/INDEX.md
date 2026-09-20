# 3-langgraph-fast 기술 문서 지도

이 디렉터리는 `3-langgraph-fast` 패키지가 소유하는 런타임·저장소 구현과 운영 계약을
설명한다. 공통 시스템 경계는 상위 [System design](../system-design.md), 10-K/10-Q 비즈니스
동작은 [US Corporate Filings](../../us-corporate-filings/INDEX.md)를 먼저 확인한다.

| 문서 | 책임 |
| --- | --- |
| [LangGraph DB Saver](3-langgraph-db-saver.md) | PostgreSQL application metadata, checkpoint saver, 전용 schema와 복구 정책 |
| [Graph DB](4-graph-db.md) | Neo4j 연결, schema 초기화, 10-K graph model, 쓰기·검색·운영 계약 |

두 저장소는 목적과 생명주기가 다르다.

- PostgreSQL `langgraph` schema: Assistant, thread, run과 실행 checkpoint.
- Neo4j `neo4j` database: 공시 문서에서 추출한 연결형 지식과 근거 검색 데이터.
