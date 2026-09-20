# BFF 기술 문서 지도

업무 모듈은 UsCorporateFilingsModule 하나, 서비스는 CompanyService/FilingService/FilingBackfillService 세 개다.

| 문서 | 책임 |
| --- | --- |
| [디렉터리 정책](directory-policy.md) | 승인된 src 구조, 단일 모듈, 외부 lib, entity/DTO, API 통합 |
| [Swagger](swagger-module.md) | 문서 URL, 생성 방식과 런타임 검증의 구분 |
| [도메인 시스템 설계](../../us-corporate-filings/system-design.md) | 저장·원문·SSE·원본/수정본 연결 |
| [BFF API 명세](../../../../2-bff-apps/src/us-corporate-filings/.docs/api-spec.md) | 공개 API 6개와 요청/응답 |
| [SEC 명세](../../../../2-bff-apps/src/lib/sec/.docs/api-spec.md) | 외부 HTTP·JSON·ZIP 계약 |
| [패키지 안내](../../../../2-bff-apps/README.md) | 명령·스크립트와 파일 유지 기준 |

백필은 POST SSE로 진행 상황을 보낸다. 별도 작업 Entity/상태 GET은 없다. 메타데이터를 먼저 적재하고 downloadDocuments=false면 원문 단계를 생략한다. 공시 조회는 원본·수정본을 독립 문서로 연결하며 자동 병합하지 않는다.

검증은 Node 회귀, 실제 Nest/PostgreSQL Bruno, Swagger MCP로 수행한다. 상세 절차는 [검증 정책](../../../validation/INDEX.md)을 따른다. 현재 수집 건수·PID·시점별 검증 결과는 stock 대신 dated flow에 기록한다.
