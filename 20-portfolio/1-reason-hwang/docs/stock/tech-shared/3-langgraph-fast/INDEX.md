# 3-langgraph-fast 기술 문서 지도

이 디렉터리는 `3-langgraph-fast` 패키지가 소유하는 런타임·저장소 구현과 운영 계약을
설명한다. 공통 시스템 경계는 상위 [System design](../system-design.md), 10-K/10-Q 비즈니스
동작은 [US Corporate Filings](../../us-corporate-filings/INDEX.md)를 먼저 확인한다.

| 문서 | 책임 |
| --- | --- |
| [LangGraph DB Saver](3-langgraph-db-saver.md) | PostgreSQL application metadata, checkpoint saver, 전용 schema와 복구 정책 |
| [Graph DB](4-graph-db.md) | Neo4j 연결, schema 초기화, 10-K graph model, 쓰기·검색·운영 계약 |
| [모델링 1 PoC](4-graph-db.md#sec-model1-001-세-보고서-문서-구조-poc) | AAPL·CPNG·NVDA Item 분할, 정제 HTML·텍스트, CLI·preview·Neo4j 적재 |
| [OpenUI](open-ui.md) | 생성 UI, 사용자 action, 모델 설정과 검증 |

두 저장소는 목적과 생명주기가 다르다.

- PostgreSQL `langgraph` schema: Assistant, thread, run과 실행 checkpoint.
- Neo4j `neo4j` database: 공시 문서에서 추출한 연결형 지식과 근거 검색 데이터.

- [SEC Intelligent UI](sec-intelligent-ui.md): OpenUI 의존 없는 SEC 질의/근거/AG-UI 구현.

- [기술적 분석 Deep Agent](../../technical-analysis/system-design.md): Yahoo 일봉·주봉 도구, TA-Lib 시그널, 공통 OpenUI 출력 및 LangGraph runtime 등록.

## LG-ENV-PORT-001: 서버 포트 환경 변수

`3-langgraph-fast/.env`와 `.env.example`은 `SERVER_PORT=2981`, `LANGGRAPH_PORT=2982`를 선언한다.
`dev`/`start`는 uv가 로드한 `SERVER_PORT`를 Uvicorn CLI `--port`에 전달한다.
`dev:langgraph`는 동일한 방식으로 `LANGGRAPH_PORT`를 LangGraph CLI `--port`에 전달한다.
미설정 기본값도 각각 2981/2982다. 셸 환경 변수가 `.env`보다 우선하고,
추가 CLI `--port`가 최종 우선한다. `langgraph.json`은 변경하지 않는다.
SEC BFF 주소는 2980, UI validator 주소는 Host의 2983을 사용한다.
공용 포트 계약은 [LOCAL-PORTS-002](../workspace.md#local-ports-002-애플리케이션-포트-프로필)를 따른다.

## CHAT-HISTORY-001: Host 대화 기록 소비

Host `/chat`은 기존 `/threads/search`와 `/threads/{id}/state`를 사용해
`source=host-chat`·`graph_id` metadata를 가진 thread의 목록과 메시지를 복원한다.
새 서버 endpoint나 DB schema는 추가하지 않는다. 서버 저장/복구 정책은 [DB Saver](3-langgraph-db-saver.md),
화면 범위와 이전 thread 제한은 [Host](../1-fe-host/open-ui.md#chat-history-001-chat-대화-기록)를 따른다.

## SEC-IXBRL-001: taxonomy-free 자체 뷰어 추출

`domains/sec_ixbrl/extractor.py`는 저장된 UTF-8 원문을 lxml로 한 번 파싱하여 fact/context/unit/차원·continuation·exclude·nil과 정제 HTML 앵커를 함께 만든다. Arelle 전체 모델·taxonomy 조회·기존 모델링 3 generation은 사용하지 않고, 설치된 Arelle/SEC 변환 레지스트리만 사용한다. 지원하지 않는 format/fraction은 raw 값을 보존하고 normalizedValue=null 및 unsupported/invalid 경고로 표현한다. 금액은 Decimal 문자열이며 nil을 0으로 바꾸지 않는다. XML 복구 fallback은 표시 전용 degraded 결과다.

`POST /internal/sec-ixbrl/extract`는 기존 `X-SEC-Modeling-Key` 서비스 인증을 사용한다. BFF가 DB 원문·SHA-256·CIK·접수번호를 전달하며 Python이 해시를 다시 확인한다. 원문 32MiB, HTTP JSON 64MiB, 250000 element/50000 fact, continuation 128단계, 30초 대기 한도다. 해시+추출기버전 단위 process-local singleflight/LRU(최대 4개·128MiB·5분), worker 동시 2개·inflight 최대 8개를 사용한다. 요청 시간 초과 뒤 이미 시작한 read-only 추출은 제한된 worker 안에서 끝나 캐시에 남을 수 있다.

공개 BFF는 metadata/facts/document 세 GET을 제공한다. Python 정제 HTML에는 원문 script·외부 리소스·meta/base·위험 CSS가 없고, fact 앵커 `data-fact-id` 및 `ix-segment-*`만 생성한다. 신뢰 bridge는 FE가 별도 nonce wrapper로 삽입한다. DB 변경·LLM·외부 SEC/taxonomy 요청은 없다. 도메인 계약은 [자체 iXBRL 뷰어](../../us-corporate-filings/ixbrl-viewer.md)를 따른다. 사용자 요청에 따라 실행 검증은 미수행이다.
