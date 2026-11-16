# 모델링 활성 publication 배치 조회

## SEC-MODELING-UI-002: 내부 읽기 계약

POST `/internal/sec-modeling/filings/status`는 기존 X-SEC-Modeling-Key 인증을 그대로 사용한다. body는 filings 배열이며 각 항목은10자리 cik와 표준 accessionNo이다.1~100개의 서로 다른 공시를 허용하고 중복·빈 배열·초과·잘못된 식별자는422다.

응답 items는 요청 순서를 유지하고 cik/accessionNo/stages를 반환한다. stages의1/2/3은 현재 SecPublication ACTIVE 관계가 가리키는 SecGeneration 속성과 generationId다. 게시 결과가 없으면 stages={}이며 이를 서비스 장애와 혼동하지 않는다.

GraphStore.active_many는 요청한 최대300개 publication ID를 parameter binding한 한 번의 읽기 Cypher로 조회한다. 전체 generation scan, 새 모델 실행, 새 generation 생성, schema 변경을 하지 않는다. 기존 개별 GET `/internal/sec-modeling/filings/{cik}/{accession}/status`는 유지한다.

BFF는 페이지 범위에서 이 API를 한 번 호출하고 실제 publication 준비 상태를 계산한다. 전체 통계는 별도 PostgreSQL 최신 run 집계이며 이 읽기 결과를 페이지 밖의 전역 readiness로 확대하지 않는다. 상세 책임은 [BFF 모델링 관리 조회](../2-bff-apps/sec-modeling-dashboard.md)를 따른다.

테스트는 GraphStore query fixture와 실제 FastAPI router HTTP를 사용한다. 외부 Neo4j/SEC/모델링 작업 없이 정상·인증·입력 경계를 확인한다. 실행 증거와 UI 상태는 도메인 flow가 소유한다.

BFF와 Python을 함께 배포하며 Python API 추가를 먼저 배포하는 순서를 권장한다. 새 BFF가 이전 Python에 연결되면 batch 요청 실패를 unavailable로 명시하고 행·PG 통계는 유지한다.
