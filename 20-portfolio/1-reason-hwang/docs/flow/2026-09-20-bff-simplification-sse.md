# BFF-DIR-001: 단일 업무 모듈·SSE 백필 통합

- 날짜: 2026-09-20
- 맥락: 사용자가 중간 다중 모듈 구조를 과도하다고 평가하고 디렉터리 정책 리뷰 후 구현 승인.
- 최종 결정: 업무 모듈 1개, 서비스 3개, 외부 SEC lib(HTTP+타입 한 파일), entity에 TypeORM/DTO, shared 설정 한 파일, API 명세 .docs.
- 변경: 업무 REST 13개→5개. 백필 POST는 metadata→optional documents SSE. 기본 downloadDocuments=true, false면 생략. 특정 기업 과거 JSON 포함. 기존 원문·parser 상태 보존, failed 재시도 내부화.
- 후속 사용자 결정: 상태 GET·작업 Entity·메모리 이력 없이 SSE로만 진행 보고. 기존 작업 테이블·migration 이력은 삭제하지 않고 미사용 상태로 보존.
- 코드 구조 정책: [BFF 디렉터리 정책](../stock/tech-shared/2-bff-apps/directory-policy.md).
- 도메인 stock: [시스템 설계](../stock/us-corporate-filings/system-design.md).
- 소비자 조사: FE·LangGraph에서 제거 API 호출 없음. 공개 Bruno와 opt-in import/live 검증 스크립트를 새 경로·AppModule로 갱신.

## 검증 (VAL-API-001, VAL-BROWSER-001)

- `pnpm test`: Node 15/15 PASS. 원자적 쓰기, 늦은 실패/성공 보호, 과거 원문 fallback, byte budget, 입력·환경 검증.
- `pnpm lint`: TypeScript PASS.
- `BRUNO_CLI=… pnpm test:companies:e2e`: 24 requests / 24 tests / 24 assertions PASS.
- `BRUNO_CLI=… pnpm test:filing-routes:e2e`: 30 requests / 30 tests / 30 assertions PASS. 격리 Docker PostgreSQL·실제 Nest HTTP, 외부 SEC만 fixture.
- 별도 HTTP stream 검증 PASS: started를 완료 전 수신, metadata-only pending/content=null, bulk 원문 왕복, sec_backfill_runs 신규 행 0.
- E2E 로그: 무시되는 `2-bff-apps/bruno-api-tests/reports/company-pagination.log`, `filing-routes.log`.
- Playwright MCP Swagger `127.0.0.1:54111/docs/sec`: 사용자 클릭·입력·Execute로 20년 특정 기업 요청, metadata 2건→documents 2건→completed 확인. 빈 대상은 HTTP 400. filings 재조회에서 본문·pagination 유지 확인.
- 브라우저 증거: `.playwright-mcp/page-2026-09-20T13-31-55-576Z.yml`, `page-2026-09-20T13-32-00-374Z.yml`, `page-2026-09-20T13-32-03-974Z.yml`. 콘솔은 의도한 400과 favicon 404이며 앱 예외 없음.
- 사용 스킬: apb-bruno-api-tests, apb-playwright-e2e, apb-unit-test-write, supabase-postgres-best-practices (일반 PostgreSQL 지침; Supabase 서비스 미사용).
- 원본 migration 4개는 내용/identity 보존, 위치만 이동. 관련 없는 사용자 변경·환경·런타임 데이터는 커밋 제외.

## 실제 SEC 실행 — 진행 중

- 사용자 명시 요청: 전체 회사 동기화 후 모든 회사 최근 20년 공시자료 수집.
- 실행: `node scripts/run-sec-backfill.cjs 20`, PID 37292. 기존 개발 서버 대신 소유한 임시 HTTP 포트 사용.
- 2026-09-20 13:33 UTC 회사 동기화 8,031개, GET companies totalItems=8,031 확인.
- 전체 백필 SSE 시작, SEC ZIP 다운로드 진행. 원문까지 요청하며 최종 수집 완료는 아직 아님.
- 로그: `2-bff-apps/data/runs/20-year-backfill.log` 및 같은 디렉터리 timestamp `.sse` (git 제외).
- 범위: 2006-09-20 이후 10-K/10-Q/8-K와 수정공시. ZIP의 SEC 기업 범위는 현재 상장 ticker snapshot보다 넓을 수 있음.

## 후속 실행 및 SEC-AMEND-001

- 최초 shell 자식 프로세스 PID 37292는 ZIP 다운로드 중 종료되어 completed 이벤트가 없었다. 13:34 UTC detached 프로세스 PID 37706으로 재실행해 터미널 종료와 분리했다. 회사 동기화는 idempotent하며 8,031개를 재확인했다.
- 사용자가 원본+연결된 수정본 조회를 추가 요청했다. 별도 파일/모듈 없이 FilingService에 구현, DTO와 Swagger/Bruno 명세 갱신.
- 현재 테스트: Node 17/17 PASS, 백필·수정본 Bruno 38 requests / 38 tests / 38 assertions PASS. 수정본 사례는 통제된 fixture이며 실제 Workhorse/Robinhood 문서를 검증한 것은 아니다.
- 실수집은 약 1.56 GB ZIP 다운로드 완료 후 메타데이터 적재 단계로 진행했다. 최종 원문 수집 완료와 별개다.

## 최종 코드 검증 및 백그라운드 확인

- SEC-AMEND-001 Swagger MCP (`127.0.0.1:54345/docs/sec`): formType=10-K/A, CIK=6, includeContent=true 입력·Execute. 원본 financial statements, 부분 Part III 수정본, 전체 재수록 수정본을 함께 확인. CIK=9/8-K/A는 original=null, ambiguous-original 확인. 브라우저 오류 0, Swagger deep-link 경고 1.
- 증거: `.playwright-mcp/amendment-query.yml`, `page-2026-09-20T13-37-42-915Z.yml`.
- 13:37 UTC PID 37706 생존 확인: metadata processedEntries=121250, filingsUpserted=1107999. 전체 수집은 미완료이며 사용자 요청대로 detached background 실행 중이다. SEC bulk 기업 범위는 현재 ticker 회사 8,031개보다 넓다.
- 코드 검증 결과: 단위 17 PASS, 회사 HTTP 24 PASS, 백필/수정본 HTTP 38 PASS, TypeScript PASS. 소유한 임시 검증 서버/DB는 정리했다. 실제 수집 프로세스와 configured DB는 유지한다.

- 13:38 UTC 실제 DB 읽기 확인: companies=406707, filings=1480998, downloaded=1, failed=0. 이어진 SSE는 metadata filingsUpserted=1490999까지 진행했다. downloaded=1은 기존 저장 문서이며 이번 원문 단계는 아직 시작 전이다. 완료를 주장하지 않고 백그라운드 실행을 유지한다.
