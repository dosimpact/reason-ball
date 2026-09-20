# US Corporate Filings 시스템 설계

> 한 줄 책임: SEC 공시 메타데이터와 원문을 로컬 PostgreSQL에서 함께 저장하고 조회한다.
>
> 상태: DB 원문 저장 구현 완료. Supabase 서비스는 사용하지 않는다.

## 구조

```text
SEC EDGAR -> NestJS bounded HTTP download -> UTF-8 검증 및 SHA-256
          -> PostgreSQL sec_collector.public.filings (원자적 UPDATE)
          -> GET /api/sec/filings?includeContent=true
          -> 원문 소비자/파서
```

PostgreSQL 접속은 BFF 환경 설정을 따른다. 기본 논리 DB 이름은 `sec_collector`이다. Neo4j는 파싱된 그래프 데이터 저장소이며 원문 저장 전환으로 변경되지 않는다.

## 컴포넌트와 경계

| 컴포넌트 | 책임 | 소유 경로 |
| --- | --- | --- |
| SEC client | 요청 속도 제한, HTTP 오류 재시도, 60초 요청 제한, bounded 응답 읽기 | `2-bff-apps/src/lib/sec/sec.client.ts` |
| 원문 변환 | UTF-8 유효성, 빈 문서/NUL 거부, BOM 보존, 실제 bytes 및 SHA-256 계산 | `2-bff-apps/src/lib/sec/sec.utils.ts` |
| Filing collector | 수집·다운로드·상태 원자 저장 | `2-bff-apps/src/us-corporate-filings/service/filing-backfill.service.ts` |
| Entity/migration | 컬럼과 완료 상태 무결성 제약 | `2-bff-apps/src/us-corporate-filings/entity/ 및 migrations/` |
| 기존 파일 이관 | checksum 검증 후 원문 적재, 원본 파일 보존 | `2-bff-apps/scripts/import-filing-files.cjs` |
| 실제 SEC 검증 | 실제 Apple 10-K 저장, HTTP 왕복, SQL hash/크기/제약 검증 | `2-bff-apps/scripts/verify-sec-database.cjs` |

## 계약과 데이터

| 컬럼 | 타입 | 의미 |
| --- | --- | --- |
| `document_content` | `text nullable` | 검증된 UTF-8 원문, 기본 ORM 조회에서는 제외 |
| `document_content_type` | `varchar(128) nullable` | HTTP Content-Type, 없으면 application/octet-stream |
| `document_downloaded_at` | `timestamptz nullable` | 원문 저장 시각 |
| `document_size_bytes` | `bigint nullable` | 실제 원문 UTF-8 byte 수; TypeScript에서는 string |
| `checksum` | `varchar(64) nullable` | 저장 원문 bytes의 SHA-256 |
| `file_size` | `bigint nullable` | SEC 메타데이터가 제공한 크기; 실제 저장 크기와 분리 |
| `file_path` | `text nullable` | 레거시 이관 출처; 신규 다운로드에서는 null |

대형 text의 물리적 저장은 PostgreSQL TOAST에 맡긴다. 원문 자체에는 검색 인덱스를 추가하지 않는다. 데이터베이스는 UTF-8을 사용한다.

## 설계 결정과 상태 전이

| ID | 결정 | 이유 |
| --- | --- | --- |
| SEC-SD-01 | 원문을 기존 `public.filings.document_content`에 저장 | 외부 파일 경로 의존 제거 |
| SEC-SD-02 | 상태, 본문, 해시, 크기, 시각을 같은 행의 한 UPDATE에서 기록 | 다운로드 완료와 본문 저장의 원자성 |
| SEC-SD-03 | HTTP 호출은 DB 트랜잭션 밖에서 수행 | 네트워크 대기 중 잠금 방지 |
| SEC-SD-04 | 기존 경로와 파일은 보존하며 별도 importer 제공 | 이관 재실행 및 원본 보존 |
| SEC-SD-05 | 목록 기본 조회에서 원문 제외, 원문 포함 페이지에 byte 예산 적용 | 불필요한 큰 본문 로딩 제한 |

- 입력 상태는 `pending`, 성공은 `downloaded`, 실패는 `failed`이다.
- 성공/실패 쓰기는 현재 상태가 `pending`일 때만 수행한다. 늦게 끝난 작업이 이미 완료된 원문을 덮어쓰거나 실패 상태로 되돌리지 않는다.
- 병렬 작업자의 중복 HTTP 다운로드 자체를 막는 lease/claim은 아직 없다. 상태 갱신은 조건부 쓰기로 보호하지만 분산 작업 스케줄러는 이 범위에 포함하지 않는다.
- 다운로드 완료 DB 제약은 본문이 비어 있지 않음, 저장 시각 존재, 실제 크기 일치, 64자리 hex checksum 존재를 강제한다. 해시 일치는 저장 코드와 검증 명령에서 계산한다.
- HTTP 실패, 잘못된 UTF-8, 빈 원문, NUL, 크기 초과는 실패 처리한다. DB 자체가 연결 불가하면 실패 상태 기록도 실패할 수 있으며 원문 없는 완료 상태는 커밋되지 않는다.
- 백필 재실행이 failed를 pending으로 되돌린 후 다시 다운로드한다.

## API

`GET /api/sec/filings?includeContent=true`는 필터에 맞는 공시와 DB 원문을 `content`로 반환한다. 본문이 없으면 null이며 downloaded만 필요하면 status=downloaded를 추가한다. 파일 시스템 fallback은 없다.

- 통합 공시 목록에 필터와 pagination을 제공한다.
- `filePath`는 nullable/deprecated. 신규 다운로드는 null.
- 정렬: filing date DESC NULLS LAST, updated_at DESC, accession_no ASC, cik ASC.
- 선택 페이지의 원문 크기 합계를 먼저 조회하고 64 MiB 초과 시 HTTP 413 반환. pageSize를 줄여 재요청한다.
- 이 예산은 JSON 인코딩/객체 메모리 전체가 아닌 원문 byte 합계이다. 동시 데이터 변경 시 두 쿼리의 페이지가 달라질 수 있어 엄격한 프로세스 메모리 상한은 아니다.
- 메타데이터 목록은 원문을 기본 포함하지 않는다. 단일 원문은 GET /filings/:cik/:accessionNo/content로 직접 조회한다.

## 마이그레이션과 기존 파일

등록된 TypeORM migration `1790000000000-filing-database-content`이 BFF 시작 시 실행된다.

1. `document_size_bytes` 추가.
2. 기존 downloaded인데 DB 원문이 없는 행은 pending으로 전환한다. 경로/파일/기존 checksum은 보존된다.
3. 이미 DB 본문이 있는 행은 실제 크기와 hash, 누락된 저장 시각을 채운다.
4. downloaded 무결성 CHECK constraint 추가.

기존 파일이 있는 환경에서는 `pnpm --filter @reason-hwang/bff-apps sec:import-files`로 이관한다. 50행 keyset 페이지로 순회하고 한 문서씩 크기를 제한해 읽는다. 기존 checksum과 다르면 적재하지 않는다. 본문이 NULL인 행에만 원자적 저장하므로 재실행 가능하다. 누락/손상 파일은 보존된 metadata로 다시 다운로드할 수 있다. 파일은 자동 삭제하지 않는다.

현재 조회는 DB 원문을 사용하며 파일 시스템 fallback은 없다. 다운 마이그레이션은 본문을 보존하지만 구버전 애플리케이션은 DB-only 원문을 읽지 못하므로, 스키마 rollback만으로 구버전 호환이 복구되지는 않는다.

## 운영과 검증

`SEC_DOCUMENT_MAX_BYTES` 기본값은 33,554,432 bytes(32 MiB). 실측 Apple 보고서는 1,520,317 bytes이며 전체 SEC 문서 크기 분포를 대표하지는 않는다. 상한 초과 문서는 실패 처리하므로 필요 시 운영자가 조정한다.

```sh
pnpm --filter @reason-hwang/bff-apps test
pnpm --filter @reason-hwang/bff-apps test:sec-live
pnpm --filter @reason-hwang/bff-apps sec:import-files
```

- 일반 test는 외부 네트워크/DB 없이 Node test runner로 회귀 검증한다.
- test:sec-live는 명시적 실행 시 실제 Apple 10-K와 회사 metadata를 설정된 sec_collector에 저장한다. 임시 localhost 포트의 API 서버를 닫지만 실데이터는 DB에 남긴다.
- SEC HTTP 원문은 로그에 출력하지 않는다. 직접 원문 응답에는 CSP sandbox와 nosniff를 적용해 스크립트 실행을 제한한다.
- 실제 SEC 연락처를 `SEC_USER_AGENT`에 설정해야 한다. 예시 연락처를 운영 설정으로 사용하지 않는다.
- PostgreSQL volume 백업/복원 정책은 원문까지 포함해야 한다. 백업 복원 실험, 다중 인스턴스 부하 시험, 비 UTF-8 공시 지원은 이번 검증 범위 밖이다.
- SQL SHA-256은 PostgreSQL 16 내장 함수 사용: [공식 binary string 함수 문서](https://www.postgresql.org/docs/16/functions-binarystring.html).

검증 증거는 [DB 원문 저장 구현 기록](../../flow/2026-09-20-sec-filing-database-content-implementation.md)에 기록한다.


## BFF-DIR-001: 현재 모듈·API 계약

[디렉터리 정책](../tech-shared/2-bff-apps/directory-policy.md)이 구조의 원본이다. `AppModule`에 업무 모듈 하나를 연결한다. TypeORM 엔티티는 Company/Filing 두 개이고 DTO는 같은 entity 디렉터리에 둔다. 서비스는 CompanyService, FilingService, FilingBackfillService 세 개다. 외부 SEC HTTP·타입·ZIP 처리·명세는 `src/lib/sec/`에 둔다.

명시적 REST API는 6개다. [BFF API 명세](../../../2-bff-apps/src/us-corporate-filings/.docs/api-spec.md)와 Bruno 컬렉션이 같은 계약을 따른다.

| API | 동작 |
| --- | --- |
| POST /company-sync-jobs | 회사 snapshot 동기화, 201 JSON |
| GET /companies | 페이지 조회, pageSize 기본 50·최대 100000, limit 호환 |
| GET /filings | 공시 페이지 조회, pageSize 최대 500, includeContent 옵션 |
| GET /filings/:cik/:accessionNo/content | 저장된 단일 원문 직접 반환 |
| POST /company-filing-sync-jobs | 지정 기업 recent·역사 JSON 수집 후 원문, 200 SSE |
| POST /all-company-filing-sync-jobs | 티커 보유 회사의 archive 메타데이터 적재 후 원문, 200 SSE |

- 회사 필터 cik/ticker/q와 공시 필터 cik/ticker/since/formType/status/parserStatus를 지원한다. pagination은 page/pageSize/totalItems/totalPages/hasNextPage이며 빈 결과 totalPages=0이다.
- 백필 기본 기간은 20년(최대 30년), 지원 폼은 10-K/10-Q/8-K와 수정공시다. 메타데이터 단계가 먼저 끝난 후 원문을 다운로드한다. downloadDocuments=false로 원문을 생략할 수 있다.
- SSE started/progress/completed/error로 진행 상황을 알린다. HTTP 200은 성공을 의미하지 않으며 마지막 이벤트와 failed 건수를 확인한다. 입력 검증 실패는 스트림 전 400이다.
- 별도 작업 Entity, 메모리 작업 이력, 상태 GET은 없다. 공시 상태는 filings에만 영속 저장한다. 기존 sec_backfill_runs 테이블과 migration은 과거 이력 보존용이며 런타임은 접근하지 않는다.
- 원문 재실행은 failed를 한 번 pending으로 되돌리고 기존 downloaded·parserStatus·checksum·본문을 보존한다. 연결 종료 시 다음 진행 보고에서 중단하고 재호출로 이어간다.
- 전체 기업 백필 중복 실행 제한은 프로세스 단위다. 다중 프로세스 분산 잠금·영구 실행 복구를 제공하지 않는다.
- 별도 다운로드/재시도/parser-status/상태 집계/백필 상태 API는 제거했다. 저장소의 FE·LangGraph 호출자 검색에서 소비자가 없음을 확인했다. 기존 원문 소비자는 filings?includeContent=true로 전환한다.
- Config는 생성 시 한 번 검증한 snapshot을 공유한다. PORT > APP_PORT > 2801. 잘못된 숫자·URL·boolean은 부팅 오류다.

## 검증과 실데이터 실행

- Node 회귀 테스트, TypeScript lint, 격리 PostgreSQL+Nest Bruno: 회사 pagination 24개, 백필/SSE·수정본·단일 원문 48개 시나리오.
- 추가 HTTP 스트림 검증: started가 작업 완료 전에 도착, metadata-only가 본문 없이 pending 저장, bulk 원문 조회 왕복, 작업 이력 테이블 쓰기 없음.
- Swagger MCP: 특정 기업 메타데이터→문서→completed, 잘못된 대상 400, 저장 원문 재조회.
- 실제 실행: `node scripts/run-sec-backfill.cjs 20`은 별도 임시 포트에서 회사 전체 동기화 후 전체 기업 20년 백필을 실행한다. configured DB를 변경하므로 명시적 요청 시만 실행한다. `DATA_DIR/runs`에 SSE 기록을 남긴다.
- 과거 opt-in `test:sec-live`는 단일 Apple 문서 실연동 검증이며 전체 수집 명령과 다르다.
- 상세 결과와 실제 수집 상태는 [구현·검증 flow](../../flow/2026-09-20-bff-simplification-sse.md)를 참조한다. 코드 검증 통과와 전체 원문 수집 완료를 구분한다.

## SEC-AMEND-001: 원본과 수정본 연결 조회

GET filings의 기본 includeAmendments=true는 각 검색 항목에 original/amendments/amendmentLinkStatus/amendmentLinkBasis를 추가한다. includeAmendments=false로 기존 평면 응답을 선택할 수 있다. 페이지네이션은 검색된 공시 행 기준이며 연결 문서는 page/since/status 필터 때문에 빠지지 않는다.

연결은 동일 회사(CIK)·기본 form·reportDate, 수정본보다 늦지 않은 원본 후보가 정확히 하나일 때만 한다. acceptedAt이 양쪽에 있으면 시간 순서도 확인한다. 원본이 없거나 여러 개이면 null과 missing-original/ambiguous-original을 표시한다. reportDate가 없으면 missing-report-date다. 회사·폼이 다르면 연결하지 않는다.

본문 수정 범위를 분석하거나 병합하지 않는다. 부분 수정본이 재무제표를 포함한다고 추정하지 않고 원본·모든 연결 수정본을 독립 문서로 노출한다. 원문 포함 조회는 중첩 반환되는 원문까지 64 MiB에 포함한다. metadata 기반 연결이며 법적 수정 범위의 확정 판정은 아니다.

검증: 부분·전체 수정본 동시 보존, 수정본 검색에서도 필터 밖 원본 표시, 다른 회사/폼 제외, 원본 누락/모호성/기간 없음, 옵션 비활성화, 중첩 원문 byte 예산. [SSE 구현·검증 기록](../../flow/2026-09-20-bff-simplification-sse.md).

- 공개 Bruno 컬렉션도 SSE 성공/실패 검사, 메타데이터-only, 원본·수정본 원문/수정본 필터 요청을 제공한다. `bruno-api-tests/README.md`를 참조한다. 이 공개 요청 6개를 별도 fixture HTTP로 검증했다.

## SEC-CONTENT-001: 단일 원문 직접 조회

`GET /api/sec/filings/:cik/:accessionNo/content`는 CIK+접수번호로 저장된 대표 원문 한 건을 찾고 JSON 포장 없이 UTF-8로 반환한다. CIK는 1~10자리 숫자를 10자리로 정규화하며 접수번호는 `##########-##-######` 형식이다. 목록 응답의 cik/accessionNo를 사용한다. 원본·수정본은 각각의 접수번호로 조회하며 병합하지 않는다. SEC 추가 요청이나 파일 fallback은 없다.

저장된 documentContentType의 MIME을 사용한다: text/html, application/xhtml+xml, application/xml, text/xml, text/plain. 알 수 없거나 누락된 MIME은 text/plain으로 반환한다. 저장된 문자열을 변환하지 않으며 charset은 UTF-8이다. 400은 잘못된 식별자, 404는 공시 없음, 409는 pending/failed 또는 본문 없음이며 오류 응답은 JSON이다.

브라우저 표시용 Content-Disposition:inline, X-Content-Type-Options:nosniff와 CSP sandbox를 적용한다. 인라인 스타일·data 이미지만 허용하며 스크립트·외부 자원은 차단하므로 SEC 사이트와 화면 모양이 다를 수 있다.

## SEC-TICKER-SCOPE-001: 전체 백필의 티커 제한

POST /all-company-filing-sync-jobs는 실행 시작 시 DB companies에서 ticker가 NULL/빈 문자열/공백이 아닌 회사의 CIK 목록을 고정한다. ZIP의 recent와 history 모두 이 목록에 해당하는 회사만 적재하며 원문 다운로드·실패 재시도에도 동일한 CIK 목록을 적용한다. 기존에 저장된 티커 없는 등록자의 pending/failed 공시는 건드리지 않는다. 지정 기업 백필은 기존 CIK/ticker 명시 방식 그대로다.

먼저 회사 동기화를 실행해야 한다. 대상이 0이면 SSE error(statusCode=404)로 종료하고 archive를 읽거나 전체 범위로 확대하지 않는다. progress 및 completed에 tickerOnly:true와 totalCompanies를 제공한다. 전체 SEC ZIP 자체의 다운로드 크기는 줄지 않지만 저장·문서 다운로드 범위는 제한된다. 티커 존재는 현재 상장기업임을 보장하지 않으며, DB에 남은 과거 티커도 포함될 수 있다. 기존 수집 데이터는 삭제하지 않는다.
