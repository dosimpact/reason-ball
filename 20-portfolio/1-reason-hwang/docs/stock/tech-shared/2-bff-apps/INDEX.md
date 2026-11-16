# BFF 기술 문서 지도

SEC 업무는 `UsCorporateFilingsModule`이 소유한다. 한국 Open DART 5개 읽기 API는 독립 `OpenDartModule` 및 `lib/dart` client가 소유한다. 두 업무는 repository·서비스·외부 client를 결합하지 않는다.

| 문서 | 책임 |
| --- | --- |
| [모델링 관리 조회](sec-modeling-dashboard.md) | 서버 페이지네이션, 필터 전체 최신 작업 집계와 publication 상태 배치 |
| [디렉터리 정책](directory-policy.md) | 승인된 src 구조, 단일 모듈, 외부 lib, entity/DTO, API 통합 |
| [로거](logger.md) | Winston 연결, 환경 선택, 파일 순환·운영·적용 범위 |
| [Swagger](swagger-module.md) | 문서 URL, 생성 방식과 런타임 검증의 구분 |
| [도메인 시스템 설계](../../us-corporate-filings/system-design.md) | 저장·원문·SSE·원본/수정본 연결 |
| [BFF API 명세](../../../../2-bff-apps/src/us-corporate-filings/.docs/api-spec.md) | 공개 API 6개와 요청/응답 |
| [SEC 명세](../../../../2-bff-apps/src/lib/sec/.docs/api-spec.md) | 외부 HTTP·JSON·ZIP 계약 |
| [패키지 안내](../../../../2-bff-apps/README.md) | 명령·스크립트와 파일 유지 기준 |

백필은 POST SSE로 진행 상황을 보낸다. 별도 작업 Entity/상태 GET은 없다. 메타데이터를 먼저 적재하고 downloadDocuments=false면 원문 단계를 생략한다. 공시 조회는 원본·수정본을 독립 문서로 연결하며 자동 병합하지 않는다.

검증은 Node 회귀, 실제 Nest/PostgreSQL Bruno, Swagger MCP로 수행한다. 상세 절차는 [검증 정책](../../../validation/INDEX.md)을 따른다. 현재 수집 건수·PID·시점별 검증 결과는 stock 대신 dated flow에 기록한다.

## LOCAL-PORTS-002: 개발 포트 연결

로컬 `.env`와 `.env.example`은 `PORT=2980`,
`REMOTE_TEMPLATE_URL=http://127.0.0.1:2984`, `REMOTE_TODO_URL=http://127.0.0.1:2985`를 선언한다.
Remote 등록 설정은 dotenv 로드 후 이 주소를 읽는다.
전체 계약은 [Workspace](../workspace.md#local-ports-002-애플리케이션-포트-프로필)를 따른다.

## DART-API-001: Open DART 중계

공개 GET 경로는 `/api/dart/corpCode.xml`, `/api/dart/list.json`, `/api/dart/document.xml`, `/api/dart/company.json`, `/api/dart/fnlttSinglAcntAll.json`이다. Host는 기존 `/api/remote-proxy/api/dart/*`를 사용한다. 키는 서버 설정 `API_K_DART`에서만 주입하며 클라이언트 인증키 인자는 거절한다. 별도 인증·권한 체계를 새로 추가한 것은 아니다.

JSON은 공식 `status/message`를 포함해 원형 반환하며 본문 업무 오류가 HTTP 200일 수 있다. ZIP은 시그니처 확인 후 `application/zip` attachment로 반환하고, ZIP 대신 받은 오류 XML은 `502` JSON 오류로 변환한다. 로컬 입력 오류 `400`, 키 미설정 `503`, 공급자·형식·크기·연결 오류 `502`를 구분한다. 고정 origin·redirect 차단·30초 timeout·JSON 8MiB/ZIP 64MiB 제한을 적용한다. 자동 재시도는 없다.

[DART 도메인 지도](../../dart-api-testing/INDEX.md), [모듈 정책](directory-policy.md#dart-api-001-독립-open-dart-모듈). 사용자 검증 위임에 따라 실행 검증은 미수행 상태다.

## SEC-IXBRL-001: 저장 원문 자체 뷰어 API

`sec-ixbrl.controller.ts`/`service/sec-ixbrl.service.ts`와 `lib/sec-ixbrl/sec-ixbrl.client.ts`가 `/api/sec/filings/:cik/:accessionNo/ixbrl` 및 그 아래 `/facts`, `/document` GET을 소유한다. DB에 다운로드 완료된 원문만 읽으며 checksum을 검증한 뒤 기존 내부 Python URL/서비스 키로 전달한다. SEC 재수집·taxonomy 다운로드·DB migration·모델링 generation 생성은 하지 않는다.

metadata의 sourceHash를 facts/document에 필수 전달한다. facts는 page당 100개, q 최대 200자, 선택 factId와 q 동시 사용 금지다. sourceHash 불일치·미다운로드 409, 없는 문서 404, 입력 400, 크기 413 및 내부 처리 오류를 구분한다. document는 script-none CSP의 정제 HTML과 `X-Source-Hash`/`X-Extractor-Version`을 반환한다. 원래 raw content API의 CSP와 동작은 유지한다. 프런트 bridge가 필요하면 이 HTML을 안전한 별도 nonce srcdoc wrapper에 넣는다.

원문 32MiB·내부 요청/응답 64MiB·30초 timeout이다. 브라우저 연결 종료가 Python worker 즉시 중단을 보장하지 않는다. 상세는 [자체 iXBRL 뷰어 도메인 설계](../../us-corporate-filings/ixbrl-viewer.md). 사용자 검증 위임에 따라 테스트/typecheck/lint/build/브라우저/실제 API 실행은 하지 않았다.
