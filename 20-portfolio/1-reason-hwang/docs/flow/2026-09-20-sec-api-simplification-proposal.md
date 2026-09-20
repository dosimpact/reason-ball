# SEC API 간소화 설계안

- 날짜: 2026-09-20
- 도메인: us-corporate-filings
- 결정 ID: SEC-API-SIMPLIFY-001
- 상태: 제안 / 미승인 / 미구현. 사용자는 통합 설계안 작성만 요청했다.
- 현재 상태: REST API 13개와 기존 Bruno 요청을 유지한다.
- 관련 stock: [시스템 설계](../stock/us-corporate-filings/system-design.md), [설계 원칙](../stock/tech-shared/design-principles.md).
- 배경: 회사·공시·백필 수집의 중첩과 여러 단계의 호출을 줄이되 개별 회사 갱신, bulk 수집, 원문 다운로드와 상태 확인을 유지한다.

## 1. 코드 확인 결과

| 현재 기능 | 확인한 동작 | 설계 판단 |
| --- | --- | --- |
| 회사 동기화 | SEC ticker snapshot으로 회사명·ticker·CIK 저장 | bulk와 일부 중첩하나 가벼운 회사 목록 갱신 목적 유지 |
| 공시 동기화 | DB 회사 목록을 대상으로 submissions의 recent 공시 수집, SIC 갱신도 수행 | bulk와 저장 대상 중첩. 특정 회사 최신 공시 갱신에 필요 |
| 백필 | bulk archive로 회사와 과거 공시 메타데이터 저장 | 개별 수집과 내부 전략을 분리하고 외부 진입점 통합 |
| 다운로드 / 재시도 | pending 원문 다운로드 / failed를 pending으로 변경만 함 | 재시도를 다운로드 옵션으로 통합 가능 |
| 공시 / 원문 목록 | limit 기반 메타데이터 목록 / page 기반 다운로드된 원문 목록 | 필터·페이지 규약을 맞춘 후 선택적 원문 포함으로 통합 가능 |
| 최신 / 특정 백필 조회 | 같은 run 모델 반환 | latest를 작업 식별자 별칭으로 제공 |
| 상태 집계 / 백필 검증 | 전체 상태별 통계 / cutoff·form 범위의 현재 DB 지표 | 의미가 달라 별도 유지 |

앞선 설명의 보완: 일반 공시 수집도 회사 SIC를 갱신하므로 회사 정보에 전혀 손대지 않는 것은 아니다. 백필 검증은 특정 실행이 생성한 행만 추적하는 검증이 아니라 실행의 cutoff·form 조건에 해당하는 현재 DB 집계다.

회사 동기화는 현재 `sic: null`을 포함해 upsert하고, 백필은 `COALESCE`로 기존 SIC를 보존한다. API 이름을 통합하기 전에 저장 필드의 소유권과 null 덮어쓰기 정책을 맞춰야 한다.

근거: `2-bff-apps/src/sec/api/collector.controller.ts`, `companies-sync.service.ts`, `filings-collector.service.ts`, `sec-backfill.service.ts`.

## 2. 권장 최종 API: 13개 → 9개

공통 접두사: `/api/sec`. 아래 경로는 모두 제안이며 현재 제공되는 계약이 아니다.

| 메서드 | 제안 경로 | 역할 / 기존 경로 대응 |
| --- | --- | --- |
| POST | `/company-sync-jobs` | 회사 목록 동기화 유지 |
| GET | `/companies` | 회사 검색·조회 유지 |
| POST | `/filing-collection-jobs` | filing-sync-jobs + filing-backfill-jobs 통합 |
| GET | `/filing-collection-jobs/:runId` | 작업 상태. runId=latest는 최근 작업 별칭 |
| GET | `/filing-collection-jobs/:runId/verification` | bulk 작업 완전성 지표. latest 별칭 허용 |
| POST | `/filing-download-jobs` | 다운로드 + retry 옵션으로 실패 재시도 통합 |
| GET | `/filings` | 메타데이터 조회 + includeContent 옵션으로 원문 조회 통합 |
| GET | `/filings/status-summary` | 상태별 집계 유지 |
| POST | `/filings/parser-status` | 파싱 상태 갱신 유지 |

계산: 수집 시작 2→1, 최신/특정 상태 조회 2→1, 다운로드/재시도 2→1, 공시/원문 조회 2→1. 합계 13→9.

latest 통합은 편의 경로를 파라미터 값으로 표현하는 변화다. 실질적인 업무 로직 중복 제거와 구분한다. 파서 상태 변경의 POST→PATCH 전환은 개수 축소와 관계없으므로 이 범위에서 제외한다.

## 3. 수집 계약

### 선택 회사 최신 메타데이터

```http
POST /api/sec/filing-collection-jobs
Content-Type: application/json

{"mode":"incremental","tickers":["AAPL"],"since":"2025-01-01","page":1,"pageSize":10}
```

### 전체 회사 과거 메타데이터

```http
POST /api/sec/filing-collection-jobs
Content-Type: application/json

{"mode":"bulk","years":20,"refreshArchive":false}
```

- mode는 필수. 누락·알 수 없는 값·다른 mode 전용 필드는 400으로 거절한다. 의도치 않은 bulk 실행을 기본값으로 만들지 않는다.
- incremental은 기존 ciks/tickers/since 및 회사 page/pageSize 의미를 보존한다. DB에 대상 회사가 없으면 안내 가능한 오류를 반환하며 전체 회사 수집으로 확대하지 않는다.
- bulk는 기존 1~30년 범위와 핵심 6개 공시 form을 유지한다. years는 저장 범위이며 archive 크기를 줄이지 않는다.
- 두 모드 모두 최종 목표는 202 + `{runId, mode, status, requestedAt}` 반환이다. 상태는 queued/running/completed/failed로 통일하고 다운로드·처리 단계는 phase로 구분한다.
- 현재 일반 수집은 동기 응답, bulk만 지속되는 run 기록을 갖는다. 통합은 단순 라우트 이름 변경이 아니며 일반 수집의 비동기 실행·상태 저장·오류 복구가 추가로 필요하다.
- 상태 조회는 공통 필드 + 모드별 progress/result를 반환한다. 대형 누적 카운터는 decimal string으로 통일하고 API 문서에 명시한다.
- latest는 기본 전체 수집 작업 중 최근 요청, `?mode=bulk`로 범위 제한 가능. 최근 작업이 없으면 200 null, 없는 UUID는 404, 잘못된 UUID는 400.
- 활성 bulk 중복 시작은 기존처럼 409. incremental 중복·동시 실행은 초기 구현에서 직렬화하고 재시작 시 미완료 작업을 failed로 정리하는 정책을 명시한다. 다중 프로세스 사용 전 DB 소유권·lease 전략이 필요하다.
- verification은 초기에는 bulk만 지원한다. incremental에 요청하면 400 + 명확한 오류 코드를 반환한다. 아직 지원하지 않는 검증을 통과로 표현하지 않는다.
- 원문 다운로드는 수집 시작에 자동 포함하지 않는다. 메타데이터만 필요한 작업과 다운로드 비용·재시도 경계를 유지한다.

## 4. 다운로드와 재시도 통합

```http
POST /api/sec/filing-download-jobs
Content-Type: application/json

{"ciks":["0000320193"],"maxFiles":20,"retryFailed":true,"retryLimit":5}
```

- retryFailed 기본 false. true면 동일 회사·기간 필터의 failed 중 최대 retryLimit개를 선택해 pending으로 복귀시키고 다운로드 대상으로 포함한다.
- 총 다운로드 시도는 maxFiles를 넘지 않는다. 재시도 대상으로 선택한 ID를 우선 처리하고 남은 예산으로 기존 pending을 처리한다. 상태만 변경한 후 전체 pending을 다시 조회해 다른 행을 처리하는 문제를 피한다.
- retryLimit는 maxFiles 이하의 양수로 제한한다. 기존 maxFiles=0 무제한 동작 유지 여부는 구현 전 계약 검토 사항이며 권장안은 명시적 양수 상한으로 전환하는 것이다.
- 기존 재시도 전용 API의 ‘상태만 복귀시키기’ 사용례는 통합 후 제공하지 않는다. 해당 운영 요구가 있으면 기존 경로를 남겨 최종 개수는 10개가 된다.
- 응답은 기존 queued/downloaded/failed에 retriedCount를 추가한다. 실패 원인·재시도 횟수를 보존하고 다운로드 완료 행을 재시도 대상에 포함하지 않는다.
- 이 단계에서는 다운로드의 동기 실행 모델을 유지한다. 수집 작업의 비동기 전환과 다운로드 큐 도입을 한꺼번에 확장하지 않는다.

## 5. 공시 목록과 원문 조회 통합

```http
GET /api/sec/filings?page=1&pageSize=20&ticker=AAPL&formType=10-K
GET /api/sec/filings?page=1&pageSize=5&ticker=AAPL&status=downloaded&includeContent=true
```

- 공통 응답 `{filters, pagination, items}`. ciks 다중 확장은 이번 범위 밖이며 현재 cik/ticker/since/formType/status/parserStatus 필터를 합친다.
- includeContent 기본 false. false일 때 본문 컬럼을 조회하지 않는다.
- true일 때 status 미지정은 downloaded로 해석하고 pending/failed 지정은 400. DB 원문이 있는 행만 반환한다.
- 본문 포함 요청은 기존 64 MiB 페이지 원문 예산과 413 응답을 유지한다. pageSize 상한, 안정적인 정렬과 빈 parserStatus 필터도 유지한다.
- 기존 limit와 page/pageSize의 차이는 호환 어댑터에서 처리한다. limit 임의 값을 pageSize로 바꾸며 응답 구조까지 몰래 바꾸지 않는다.
- status-summary는 전체 조건의 집계이며 현재 페이지의 항목 수가 아니므로 별도 유지한다.

## 6. 유지할 기능과 내부 구조

회사 동기화를 백필에만 종속시키면 회사 목록 갱신에도 bulk archive가 필요해진다. 따라서 회사 조회·동기화 2개는 유지한다. metadata와 본문 목록은 공통 조회 계약으로 묶지만 내부 선택·본문 예산 계산은 분리한다.

컨트롤러는 검증·정규화, 수집 orchestration은 mode별 전략 선택, 각 기존 서비스는 SEC 통신·수집을 담당한다. 모든 업무를 하나의 거대 함수로 합치지 않는다(DESIGN-SLAP-001).

데이터 쓰기 원칙: CIK / accessionNo+CIK 식별자를 보존하고 메타데이터 재수집이 원문·checksum·다운로드 상태·parser 상태를 덮어쓰지 않도록 한다. 회사 ticker snapshot에 없는 SIC는 기존 값을 보존한다. 구체 migration·SQL은 구현 설계에서 별도 검토한다.

## 7. 전환 순서와 영향

1. 호출자 조사: 현재 `1-fe-host/src`, `3-langgraph-fast/src`의 기존 경로 리터럴 검색에는 직접 호출이 없었다. 동적 URL·외부 도구까지 부재라고 단정할 수 없으므로 스크립트·운영자·프록시 호출도 구현 전에 조사한다.
2. 우선 다운로드/재시도와 목록/원문을 통합한다. 최종 공개 경로 11개 단계까지 진행 가능. 실제 경로 제거는 호출자 전환 이후다.
3. 수집 run 공통 모델과 비동기 실행을 구현한 후 일반 수집/bulk와 상태 경로를 통합해 9개로 축소한다. 기존 bulk UUID 이력은 새 경로에서도 조회 가능하게 한다.
4. 전환 기간에는 구 경로 어댑터가 기존 상태 코드·응답 형태를 유지한다. 따라서 일시적으로 실제 등록 경로 수가 늘 수 있다. 제거 후의 목표가 9개다.
5. Bruno는 신규 경로로 전환하되 incremental/bulk, 기본/재시도, 본문 없음/포함, latest/ID별 요청 파일은 각각 유지한다. API 경로 9개가 테스트 파일 9개를 뜻하지 않는다.
6. 서버 검증 통과 후 Swagger, API_SPEC, stock을 확정된 계약으로 갱신하고 flow에 실행 증거를 남긴다. 코드 변경과 데이터 마이그레이션은 이 설계안 작성 범위 밖이다.

## 8. 구현 시 검증 계획

| 시나리오 | Given / When / Then |
| --- | --- |
| SIM-01 | 선택 회사 / incremental 수집 / 202, 동일 runId로 완료·결과 조회 |
| SIM-02 | 격리된 소형 bulk fixture / bulk 수집 / 회사·과거 메타데이터 저장, 원문 자동 다운로드 없음 |
| SIM-03 | mode 누락 또는 옵션 혼합 / 시작 요청 / 400, 작업·DB 변경 없음 |
| SIM-04 | 활성 bulk / 다시 시작 / 409 |
| SIM-05 | 작업 없음·잘못된 UUID·없는 UUID / 상태 조회 / 각각 200 null·400·404 |
| SIM-06 | failed와 pending 혼재 / retryFailed=true / 동일 필터·상한 내 재시도 우선, 카운터 일치 |
| SIM-07 | 같은 데이터 / 본문 옵션별 조회 / 기본 본문 없음, true 원문 포함, 64 MiB 초과 413 |
| SIM-08 | 다운로드·파싱 완료 행과 SIC 존재 / 메타데이터·회사 재동기화 / 원문·상태·SIC 보존 |
| SIM-09 | 처리 중·완료 bulk / verification / 지표 정확성, false를 무조건 실패로 취급하지 않음 |
| SIM-10 | 기존 bulk UUID 및 구 API 호출 / 호환 기간 / 이력 접근과 기존 계약 유지 |
| SIM-11 | 실행 중 서버 재시작 / 상태 조회 / 미완료 run이 영구 running으로 남지 않음 |

VAL-API-001에 따라 격리된 테스트 DB와 소형 SEC 응답 fixture를 연결한 실제 API 서버에 Bruno HTTP E2E를 실행한다. 외부 SEC 통신은 fixture로 제어하되 API 서버·DB 저장을 통째로 mock하지 않는다. 서버·포트·임시 데이터를 소유하고 정리한다. UI 연결이 생기면 VAL-BROWSER-001, 순수 View 변경이면 VAL-VIEW-001도 적용한다.

## 9. 이번 설계 작업의 검증 및 미결 사항

- 문서 작성만 수행. 서버·Bruno·DB 변경 없음. 실행 검증 정책의 문서 전용 기준으로 로컬 링크·경로 매핑·diff를 검사한다.
- 제안 결정 필요: 9개 최종안, 재시도 상태 복귀 전용 기능 폐지, 다운로드 무제한 옵션 처리, 일반 수집 비동기 전환 및 호환 기간.
- 권장: 11개 단계부터 구현해 호출 단계를 줄인 뒤, 필요성과 공통 run 모델 비용을 확인하고 9개 단계로 진행한다.
- stock 영향: 현재 API 13개 기술은 유지. 이 제안으로 이동하는 링크만 추가한다. 승인 전 제안을 현재 아키텍처로 기록하지 않는다.
