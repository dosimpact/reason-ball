# US Corporate Filings 시스템 설계

> 한 줄 책임: SEC 공시 메타데이터와 원문을 로컬 PostgreSQL에서 함께 저장하고 조회한다.
>
> 상태: DB 원문 저장 구현 완료. Supabase 서비스는 사용하지 않는다.

## 구조

```text
SEC EDGAR -> NestJS bounded HTTP download -> UTF-8 검증 및 SHA-256
          -> PostgreSQL sec_collector.public.filings (원자적 UPDATE)
          -> GET /api/sec/filings/downloaded-reports
          -> 원문 소비자/파서
```

PostgreSQL 접속은 BFF 환경 설정을 따른다. 기본 논리 DB 이름은 `sec_collector`이다. Neo4j는 파싱된 그래프 데이터 저장소이며 원문 저장 전환으로 변경되지 않는다.

## 컴포넌트와 경계

| 컴포넌트 | 책임 | 소유 경로 |
| --- | --- | --- |
| SEC client | 요청 속도 제한, HTTP 오류 재시도, 60초 요청 제한, bounded 응답 읽기 | `2-bff-apps/src/sec/common/sec/sec-client.service.ts` |
| 원문 변환 | UTF-8 유효성, 빈 문서/NUL 거부, BOM 보존, 실제 bytes 및 SHA-256 계산 | `2-bff-apps/src/sec/common/sec/document-content.ts` |
| Filing collector | 원문과 상태 원자 저장, DB 원문 조회 | `2-bff-apps/src/sec/filings-collector/filings-collector.service.ts` |
| Entity/migration | 컬럼과 완료 상태 무결성 제약 | `2-bff-apps/src/sec/common/db/` |
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
| SEC-SD-05 | 목록 기본 조회에서 원문 제외, 본문 페이지에 byte 예산 적용 | 불필요한 큰 본문 로딩 제한 |

- 입력 상태는 `pending`, 성공은 `downloaded`, 실패는 `failed`이다.
- 성공/실패 쓰기는 현재 상태가 `pending`일 때만 수행한다. 늦게 끝난 작업이 이미 완료된 원문을 덮어쓰거나 실패 상태로 되돌리지 않는다.
- 병렬 작업자의 중복 HTTP 다운로드 자체를 막는 lease/claim은 아직 없다. 상태 갱신은 조건부 쓰기로 보호하지만 분산 작업 스케줄러는 이 범위에 포함하지 않는다.
- 다운로드 완료 DB 제약은 본문이 비어 있지 않음, 저장 시각 존재, 실제 크기 일치, 64자리 hex checksum 존재를 강제한다. 해시 일치는 저장 코드와 검증 명령에서 계산한다.
- HTTP 실패, 잘못된 UTF-8, 빈 원문, NUL, 크기 초과는 실패 처리한다. DB 자체가 연결 불가하면 실패 상태 기록도 실패할 수 있으며 원문 없는 완료 상태는 커밋되지 않는다.
- 재시도 API가 failed를 pending으로 되돌린 후 다시 다운로드한다.

## API

`GET /api/sec/filings/downloaded-reports`는 `status='downloaded' AND document_content IS NOT NULL` 행을 조회하여 `content`로 반환한다. 파일 시스템 fallback은 없다.

- 기존 필터와 pagination 응답 구조 유지.
- `filePath`는 nullable/deprecated. 신규 다운로드는 null.
- 정렬: filing date DESC NULLS LAST, updated_at DESC, accession_no ASC, cik ASC.
- 선택 페이지의 원문 크기 합계를 먼저 조회하고 64 MiB 초과 시 HTTP 413 반환. pageSize를 줄여 재요청한다.
- 이 예산은 JSON 인코딩/객체 메모리 전체가 아닌 원문 byte 합계이다. 동시 데이터 변경 시 두 쿼리의 페이지가 달라질 수 있어 엄격한 프로세스 메모리 상한은 아니다.
- 메타데이터 목록은 원문을 기본 포함하지 않는다. 별도 단일 문서 endpoint는 아직 추가하지 않았다.

## 마이그레이션과 기존 파일

등록된 TypeORM migration `1790000000000-filing-database-content`이 BFF 시작 시 실행된다.

1. `document_size_bytes` 추가.
2. 기존 downloaded인데 DB 원문이 없는 행은 pending으로 전환한다. 경로/파일/기존 checksum은 보존된다.
3. 이미 DB 본문이 있는 행은 실제 크기와 hash, 누락된 저장 시각을 채운다.
4. downloaded 무결성 CHECK constraint 추가.

기존 파일이 있는 환경에서는 `pnpm --filter @reason-hwang/bff-apps sec:import-files`로 이관한다. 50행 keyset 페이지로 순회하고 한 문서씩 크기를 제한해 읽는다. 기존 checksum과 다르면 적재하지 않는다. 본문이 NULL인 행에만 원자적 저장하므로 재실행 가능하다. 누락/손상 파일은 보존된 metadata로 다시 다운로드할 수 있다. 파일은 자동 삭제하지 않는다.

현재 로컬 DB는 구현 전 filings 0행이었으므로 이관 대상이 없었다. 기존 파일 서비스와의 무중단 이중 읽기를 구현하지 않고 DB 원문 조회로 바로 전환했다. 다운 마이그레이션은 본문을 보존하지만 구버전 애플리케이션은 DB-only 원문을 읽지 못하므로, 스키마 rollback만으로 구버전 호환이 복구되지는 않는다.

## 운영과 검증

`SEC_DOCUMENT_MAX_BYTES` 기본값은 33,554,432 bytes(32 MiB). 실측 Apple 보고서는 1,520,317 bytes이며 전체 SEC 문서 크기 분포를 대표하지는 않는다. 상한 초과 문서는 실패 처리하므로 필요 시 운영자가 조정한다.

```sh
pnpm --filter @reason-hwang/bff-apps test
pnpm --filter @reason-hwang/bff-apps test:sec-live
pnpm --filter @reason-hwang/bff-apps sec:import-files
```

- 일반 test는 외부 네트워크/DB 없이 Node test runner로 회귀 검증한다.
- test:sec-live는 명시적 실행 시 실제 Apple 10-K와 회사 metadata를 설정된 sec_collector에 저장한다. 임시 localhost 포트의 API 서버를 닫지만 실데이터는 DB에 남긴다.
- SEC HTTP 원문은 로그에 출력하지 않는다. 원문 HTML을 브라우저에서 직접 실행하지 않도록 소비자가 처리해야 한다.
- 실제 SEC 연락처를 `SEC_USER_AGENT`에 설정해야 한다. 현재 로컬 예시 연락처 상태에서도 이번 요청은 성공했지만 운영 설정 보완이 필요하다.
- PostgreSQL volume 백업/복원 정책은 원문까지 포함해야 한다. 백업 복원 실험, 다중 인스턴스 부하 시험, 비 UTF-8 공시 지원은 이번 검증 범위 밖이다.
- SQL SHA-256은 PostgreSQL 16 내장 함수 사용: [공식 binary string 함수 문서](https://www.postgresql.org/docs/16/functions-binarystring.html).

검증 증거는 [DB 원문 저장 구현 기록](../../flow/2026-09-20-sec-filing-database-content-implementation.md)에 기록한다.


## SEC-BRUNO-001: BFF REST 요청 컬렉션

`2-bff-apps/bruno-api-tests/`는 BFF `/api/sec`의 명시적 REST 라우트 13개를 모두 포함한다. Swagger 문서·remote 정적 자산 경로와 별도 FastAPI 서비스는 이 범위 밖이다.

- `01-companies`: 회사 동기화·조회 2개.
- `02-filing-jobs`: 공시 동기화·다운로드·재시도 3개.
- `03-filings`: 공시 조회·상태 변경 4개.
- `04-backfill-jobs`: 백필 시작·최근 작업·특정 작업·완전성 조회 4개.
- local/dev/staging에 `backfillYears`(20), `backfillRefreshArchive`(false), `backfillRunId`(빈 값)를 둔다. dev/staging URL은 실제 환경으로 교체해야 한다.
- 백필 시작은 HTTP 202와 run 정보를 반환하고 런타임 `backfillRunId`를 설정한다. 최근 작업 조회는 선택된 ID가 없을 때만 ID를 설정한다. 특정 작업·완전성 조회는 ID가 필요하다.
- 백필 시작은 SEC bulk archive 다운로드와 DB 변경을 수행한다. years는 보존 기간이며 다운로드 크기 제한이 아니다. 진행 중인 작업이 있으면 409를 반환한다.
- 최근 작업이 없으면 null/빈 응답을 허용한다. 완전성 응답 테스트는 지표 타입을 확인하며 진행 중인 작업의 false를 실패로 취급하지 않는다.
- `pnpm --filter @reason-hwang/bff-apps bruno`로 연다. 시작 요청 없이 기존 작업을 조회하려면 최근 작업 요청을 실행하거나 환경의 ID를 설정한다. 기존 런타임 ID가 있으면 먼저 제거해야 환경 ID로 전환된다.

요청 등록 범위와 런타임 E2E 통과는 구분한다. 이번 추가의 정적 검증 및 실제 HTTP 미실행 상태는 [백필 Bruno 추가 기록](../../flow/2026-09-20-backfill-bruno-coverage.md)을 참조한다.


## 검토 중인 API 간소화 제안

[SEC-API-SIMPLIFY-001 설계안](../../flow/2026-09-20-sec-api-simplification-proposal.md)은 현재 13개 API를 단계적으로 11개, 최종 9개로 줄이는 미승인 제안이다. 현재 구현과 Bruno 계약은 위의 13개를 유지하며, 이 링크는 변경된 계약을 의미하지 않는다.
