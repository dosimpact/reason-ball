# SEC-MODELING-001: 통합 모델링 구현 시작

날짜: 2026-11-14. 상태: 구현·검증 진행 중, 완료 기록 아님.

## 승인된 범위

- 지정된 AAPL·CPNG·NVDA 3개 10-K로 모델링 1/2/3, 작업 관리 Admin, Agent 검색을 검증한다.
- BFF는 PostgreSQL 작업 기록과 단일 실행기를 소유하고 FastAPI가 모델링을 수행한다.
- 가공 데이터와 벡터 검색은 Neo4j, 원본은 수집 PostgreSQL에 보존한다.
- 모델링 2는 Lexical Graph 6종 전체, Item 하나당 Source 하나, Chunk/Statement 임베딩.
- 추출 기본 모델 sol, 선택 luna; 별도 OpenAI embeddings 연결로 text-embedding-3-small 1536차원.
- 모델링 3은 Arelle 기반 7종 XBRL 스키마. 원본/XML 전체를 Neo4j에 복제하지 않는다.
- Admin은 별도 /sec-modeling, 로컬 전용. 검색 API는 근거·정형 사실을 반환하며 답변은 Agent 책임.
- Redis/Qdrant/pgvector 제외. 기존 코드 교체, 기존 Neo4j 데이터 보존.
- human-docs 및 다른 사용자 변경을 수정하지 않는다.

## 작업 분담

BFF/PostgreSQL, FastAPI/Neo4j, Host Admin을 각각 별도 에이전트가 구현한다.
주 에이전트는 계약 조율·통합 검증·stock 동기화를 담당한다.

## 완료 기준

모델링 1 실제 Item 23개씩 및 표·수치 보존, 모델링 2 6종 그래프와 검색 Recall@10 ≥90%
(한국어15/영어15 질문), 모델링 3 정형값·맥락 검증, 작업 실패·재시도·버전 격리,
Bruno API E2E·Storybook·Playwright MCP 검증 및 소유한 실행 자원 정리까지 필요하다.
실제 외부 모델 자격 증명이 없거나 필수 검증이 미실행이면 완료로 기록하지 않는다.

## 관련 stock

- [도메인 시스템](../stock/us-corporate-filings/system-design.md)
- [Graph DB](../stock/tech-shared/3-langgraph-fast/4-graph-db.md)
- [BFF 지도](../stock/tech-shared/2-bff-apps/INDEX.md)

후속 결과는 새 dated flow에 기록하고 실제 구현에 맞게 stock을 동기화한다.
