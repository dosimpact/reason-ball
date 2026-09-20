# BFF 디렉터리 및 모듈 정책

> 상태: 승인 및 구현. 2026-09-20 사용자 리뷰와 SSE 추가 결정 반영.
> 정책 ID: BFF-DIR-001

## 1. 기본 원칙

1. 직접 만드는 업무 Nest 모듈은 `UsCorporateFilingsModule` 하나다. `AppModule`에 장착한다.
2. 외부 API 연동은 `src/lib/{provider}/`에 둔다. SEC HTTP·ZIP 처리·외부 응답 타입·명세를 `lib/sec`에 모은다.
3. 업무 데이터와 API DTO는 `src/us-corporate-filings/entity/`에 둔다.
4. 서비스는 사용자 업무 기준으로만 나눈다. 읽기·쓰기라는 이유만으로 QueryService/CommandService를 추가하지 않는다.
5. 공통 설정 서비스는 `src/shared/config.service.ts`에 둔다. 폴더마다 Module이나 재수출 index/proxy를 만들지 않는다.
6. 기존 데이터·공시 원문·migration 이력은 보존한다. 불필요한 구조를 지우는 것과 데이터를 지우는 것은 구분한다.

## 2. 목표 디렉터리

```text
src/
├── main.ts
├── app.module.ts
├── shared/
│   └── config.service.ts                 # 환경값 로딩·검증·제공
├── lib/
│   └── sec/
│       ├── sec.client.ts                 # SEC HTTP, 제한·재시도 및 외부 JSON 타입
│       ├── sec.utils.ts                  # SEC 식별자·URL·원문 변환
│       ├── sec.archive.ts                # bulk ZIP 읽기·외부 JSON 변환
│       └── .docs/
│           └── api-spec.md               # 외부 SEC API 명세
├── us-corporate-filings/
│   ├── us-corporate-filings.module.ts     # 업무 provider 등록 한 곳
│   ├── us-corporate-filings.controller.ts # 아래 업무 API 라우팅
│   ├── entity/
│   │   ├── company.entity.ts             # TypeORM 회사
│   │   ├── filing.entity.ts              # TypeORM 공시·원문
│   │   ├── company.dto.ts                # 회사 요청·응답 DTO
│   │   ├── filing.dto.ts                 # 공시 조회·수집 DTO·SSE 진행 타입
│   │   └── request-validation.ts         # DTO 공통 입력 검증
│   ├── service/
│   │   ├── company.service.ts            # 회사 동기화 + 회사 조회
│   │   ├── filing.service.ts             # 기업 공시 조회
│   │   └── filing-backfill.service.ts    # 특정 기업 + 전체 기업 수집
│   ├── migrations/                       # 기존 migration 파일 그대로 이동
│   └── .docs/
│       └── api-spec.md                   # 우리 BFF 공개 API 명세
└── remote-delivery/
    ├── remotes.config.ts
    └── remotes.middleware.ts             # 기존 remote 전달 기능
```

- `entity` 안에서 ORM entity와 DTO는 파일 접미사로 구분한다. 외부 SEC 응답 타입을 여기에 섞지 않는다.
- SEC 외부 요청·응답 타입은 `sec.client.ts`에 함께 정의한다. 별도 `sec.types.ts` 파일은 만들지 않는다.
- `.docs`는 해당 코드의 API 명세 위치이며, 디렉터리 정책의 원본은 이 문서다. 외부 SEC API와 BFF API 명세는 소유자가 달라 각각 둔다.
- 백필 작업 Entity·상태 조회 API·메모리 이력은 만들지 않는다. 진행 상황은 POST 응답 SSE로 전송하고, 공시별 영구 상태는 `filings`에 저장한다. 과거 `sec_backfill_runs` 테이블과 migration은 이력 보존만 하며 런타임에서 읽거나 쓰지 않는다.
- DB 연결은 AppModule의 `TypeOrmModule.forRootAsync`, 업무 repository 등록은 UsCorporateFilingsModule의 `TypeOrmModule.forFeature`로 처리한다. 별도 사용자 정의 DatabaseModule을 만들지 않는다.
- 설정 클래스와 SEC client는 필요한 모듈에서 직접 provider로 등록한다. 별도 ConfigModule/SecClientModule은 만들지 않는다. 설정은 bootstrap에서 한 번 검증하고 DI에 동일 snapshot을 제공하여 중복 파싱을 피한다.

## 3. 남길 업무 API

공통 prefix는 `/api/sec`. 수집 API 경로는 직전에 합의한 이름을 우선 유지한다.

| 업무 | 메서드·경로 | 서비스 | 책임 |
| --- | --- | --- | --- |
| 회사 동기화 | `POST /company-sync-jobs` | CompanyService | SEC 회사 정보를 DB에 동기화 |
| 회사 조회 | `GET /companies?page=1&pageSize=...` | CompanyService | 검색·페이지네이션, 최대 100000, limit 호환 |
| 기업 공시 조회 | `GET /filings?cik=...&page=1&pageSize=...` | FilingService | 기업별 공시 목록; 선택적으로 원문 포함 |
| 단일 원문 조회 | `GET /filings/:cik/:accessionNo/content` | FilingService | 저장 원문 직접 반환 |
| 특정 기업 공시 backfill | `POST /company-filing-sync-jobs` | FilingBackfillService | 지정 기업의 기간 내 공시자료 수집·SSE |
| 전체 기업 공시 backfill | `POST /all-company-filing-sync-jobs` | FilingBackfillService | 전체 기업의 기간 내 공시자료 일괄 수집·SSE |

업무 API는 위 6개로 정리한다. 기존의 메타데이터 수집 → 다운로드 → 실패 복귀 요청을 사용자가 순서대로 호출하게 하지 않는다.

### 수집 범위의 의미

- 특정 기업 수집은 회사 CIK 또는 ticker를 명시한다. 미지정 시 전체 기업 수집으로 확대하지 않는다.
- 특정 기업은 recent와 기간에 해당하는 과거 submission 파일을 모두 읽는다. 회사가 DB에 없으면 회사 동기화를 먼저 실행한다.
- 전체 기업 수집은 SEC bulk 데이터를 사용한다. 회사 데이터도 함께 저장할 수 있지만, 회사 목록만 갱신하는 가벼운 회사 동기화 API는 유지한다.
- 두 방식 모두 내부에서 메타데이터 저장·필요한 원문 다운로드·제한된 실패 재시도를 처리한다. 이미 완료된 원문·파싱 상태를 덮어쓰지 않는다.
- 메타데이터를 먼저 수집한 후 원문을 다운로드한다. `downloadDocuments` 기본 true, false이면 원문 단계를 건너뛴다. 이미 downloaded인 원문은 보존하고 failed는 재실행 시 다시 시도한다.
- 기업 공시 조회는 원본·수정본 연결 정보를 기본 포함한다(SEC-AMEND-001). 별도 병합 서비스나 Entity는 만들지 않는다. 기본적으로 원문 없이 반환하고, `includeContent=true`일 때 저장된 원문을 포함한다. 기존 원문 응답 용량 제한은 유지한다.

## 4. 제거·통합 대상

| 현재 구조 또는 API | 목표 |
| --- | --- |
| CompaniesSyncModule, FilingsCollectorModule, SecClientModule, ConfigModule, DatabaseModule | 업무 모듈 하나 + AppModule의 framework 설정으로 통합 |
| api / companies / filings / domain / integrations / persistence의 다중 계층 | controller / entity / service와 외부 lib 경계로 정리 |
| FilingsQueryService | FilingService에 통합 |
| 별도 메타데이터 수집·다운로드·retry 서비스 경계 | FilingBackfillService의 내부 작업 단계로 통합 |
| 여러 request pipe 파일 | DTO 가까이 검증 정의; 꼭 필요한 경우 단일 검증 helper만 사용 |
| re-export proxy 파일 | 삭제하고 실제 파일 직접 참조 |
| downloaded-reports API | 기업 공시 조회의 원문 포함 옵션으로 통합 |
| filing-download-jobs / filing-retry-jobs API | backfill 내부 작업으로 통합 |
| status-summary / parser-status API | 삭제. 저장된 parserStatus는 보존하고 공시 조회로 확인. 저장소 내 호출자 없음 |
| backfill latest / run / verification 전용 API | 삭제. 백필 POST SSE 진행 이벤트로 대체 |

단순히 파일을 합쳐 거대 서비스 하나를 만들지 않는다. 서비스 내 함수는 동기화·선택·저장 등 업무 단계로 유지하고, SEC 전용 전송·파싱은 lib에 둔다. 파일을 추가할 때는 독립 책임이나 실제 재사용이 있어야 한다.

## 5. 승인된 SSE 계약

- 백필 POST 2개는 HTTP 200 `text/event-stream`을 반환한다. `started` → `progress` → `completed` 또는 `error` 순서다. 진행 phase는 `archive`(전체 기업만), `metadata`, `documents`다.
- 검증 실패는 스트림 시작 전 HTTP 400. 스트림 시작 후 실패는 `error` 이벤트의 statusCode/message로 알린다. 200만으로 성공을 판정하지 않는다. completed의 failed 수가 0보다 크면 일부 원문 수집이 실패한 것이다.
- 별도 runId·작업 Entity·GET 상태 조회·자동 재연결은 없다. 재실행은 기존 filings를 이용하며 완료 원문을 건너뛴다.
- 연결이 끊기면 다음 진행 보고 시 작업을 중단한다. 이미 진행 중인 SEC 요청·DB 배치는 끝날 수 있다. SSE heartbeat는 15초 간격이다.
- 브라우저는 POST를 지원하는 streaming fetch를 사용한다. 기본 EventSource는 GET 전용이다. CLI는 `curl -N`으로 호출한다.
- 전체 기업 백필 중복 실행은 한 프로세스 내에서 제한한다. 분산 작업 잠금·영구 작업 이력·재시작 자동 복구는 구현하지 않는다.
- 기간은 기본 20년·최대 30년이며 기존 지원 범위 10-K/10-Q/8-K와 수정공시를 유지한다. ‘전체 기업’은 DB에 티커가 있는 회사로 제한한다.

## 6. 검증과 운영

- `pnpm --filter @reason-hwang/bff-apps test`, `lint`
- `pnpm --filter @reason-hwang/bff-apps test:companies:e2e`, `test:filing-routes:e2e`: 격리 PostgreSQL과 실제 Nest HTTP, 외부 SEC만 fixture.
- Swagger에서 실제 클릭·입력·실행을 MCP로 검증한다.
- 실제 SEC 전체 동기화·백필은 명시적으로 요청된 경우 수행하며 실행 로그는 무시되는 runtime data 경로에 기록한다.

구현·검증·실행 기록: [BFF 단순화 및 SSE](../../../flow/2026-09-20-bff-simplification-sse.md).

## SEC-TICKER-SCOPE-001: 전체 백필의 티커 제한

POST /all-company-filing-sync-jobs는 실행 시작 시 DB companies에서 ticker가 NULL/빈 문자열/공백이 아닌 회사의 CIK 목록을 고정한다. ZIP의 recent와 history 모두 이 목록에 해당하는 회사만 적재하며 원문 다운로드·실패 재시도에도 동일한 CIK 목록을 적용한다. 기존에 저장된 티커 없는 등록자의 pending/failed 공시는 건드리지 않는다. 지정 기업 백필은 기존 CIK/ticker 명시 방식 그대로다.

먼저 회사 동기화를 실행해야 한다. 대상이 0이면 SSE error(statusCode=404)로 종료하고 archive를 읽거나 전체 범위로 확대하지 않는다. progress 및 completed에 tickerOnly:true와 totalCompanies를 제공한다. 전체 SEC ZIP 자체의 다운로드 크기는 줄지 않지만 저장·문서 다운로드 범위는 제한된다. 티커 존재는 현재 상장기업임을 보장하지 않으며, DB에 남은 과거 티커도 포함될 수 있다. 기존 수집 데이터는 삭제하지 않는다.

## 개발·검증 빌드 출력 분리

`pnpm dev`는 tsconfig.dev.json을 사용해 dist-dev/에 출력한다. 일반 build 및 테스트는 dist/를 사용한다. Nest deleteOutDir이 다른 프로세스의 실행 파일을 삭제하지 않도록 출력과 incremental 캐시를 분리한다. 설정 변경 전부터 실행 중인 watch는 한 번 재시작한다. 두 출력 디렉터리는 커밋하지 않는다.

## BFF-LOG-001: Winston 로깅

Nest 로거는 `src/shared/logger.ts`의 nest-winston 어댑터를 사용한다. 기존 `new Logger(Service.name)` 호출과 Nest 부팅 로그에 공통 적용한다. 별도 업무 모듈은 추가하지 않는다.

- APP_ENV=local: Console transport, 사람이 읽는 Nest 형식. 기본 레벨 debug.
- APP_ENV=stage 또는 prod: File transport만 사용, JSON(timestamp/level/message/context 및 오류 stack). 기본 레벨 info.
- APP_ENV 생략 시 NODE_ENV를 사용한다. development/test→local, staging→stage, production→prod. 모두 생략 시 local. 잘못된 환경/로그 레벨은 시작 전에 실패한다.
- LOG_DIR 기본 ./data/logs. application.log는 설정 레벨 이상 전체 로그, error.log는 error 로그. 파일당 10 MiB, 각각 최대 5개 순환 보관. LOG_LEVEL로 수준 변경.
- `APP_ENV=stage pnpm start` 또는 `APP_ENV=prod pnpm start` (먼저 pnpm build). 로컬은 pnpm dev.
- 자동 백필 runner의 Nest 로그도 같은 설정을 사용한다. runner의 콘솔 진행 출력과 DATA_DIR/runs SSE 기록은 별도 실행 결과물로 유지한다. 모든 console.log를 가로채지는 않는다.
- HTTP 접근 로그 및 백필 이벤트 추가 로깅은 구현 범위 밖이다. 기존 개발 서버의 stdout 리다이렉션 파일은 Winston File transport가 아니다.

참조: [Nest 로거](https://docs.nestjs.com/techniques/logger), [nest-winston](https://github.com/gremo/nest-winston).
