# SEC-TICKER-SCOPE-001: 전체 수집 중단 및 티커 범위 제한

- 날짜: 2026-09-20
- 도메인/패키지: us-corporate-filings / 2-bff-apps
- 배경: 약 220만 건 대기 규모 확인 후 사용자가 즉시 중단, 전체 기업 백필 기본 대상을 티커 보유 등록자로 제한하도록 요청.
- 운영 조치: 소유 background run-sec-backfill.cjs 프로세스 PID 37706 확인 후 SIGTERM. ps/pgrep에서 종료 확인. 마지막 로그 documents downloaded=3703, failed=0. 기존 데이터 보존. 실제 백필 재시작하지 않음. 마지막 로그 수치는 DB 총 다운로드 건수와 별개인 이번 실행 진행 수치.
- 구현: backfillAll이 DB ticker 비어 있지 않은 회사 CIK snapshot을 선택. archive entry를 CIK로 걸러 메타데이터와 회사 적재. 동일 CIK로 실패 reset 및 pending 문서 조회 제한. recent/history 모두 포함, selected API 동작 보존. 별도 옵션/모듈/엔티티 추가 없음.
- 범위 0개: archive 처리 전 SSE error 404. 전체 범위로 fallback 없음. SSE progress/completed tickerOnly=true,totalCompanies 제공.
- 의미: ticker 유무는 상장 여부와 다름. 최신 SEC 회사 동기화가 선행되어야 함. 기존 DB의 오래된 ticker는 포함될 수 있음. ZIP 다운로드 용량은 기존과 동일하며 실제 적재/원문 다운로드만 제한.
- stock: [도메인 설계](../stock/us-corporate-filings/system-design.md#sec-ticker-scope-001-전체-백필의-티커-제한), [디렉터리 정책](../stock/tech-shared/2-bff-apps/directory-policy.md), BFF API 명세, README 및 Bruno 설명/검증 갱신.

## 검증

- VAL-API-001 Given: ticker 있는 회사의 recent/history ZIP, 공백 ticker의 recent/history ZIP, NULL ticker의 기존 pending/failed 원문. When: 전체 백필 호출. Then: 티커 보유 회사 문서만 적재/다운로드하고 NULL/공백 ticker 문서 및 실패 횟수 보존. 모든 ticker 제거 후 호출하면 archive 없이 SSE 404.
- 격리 Docker PostgreSQL+실제 Nest HTTP+외부 SEC fixture. `BRUNO_CLI=<installed CLI> pnpm --filter @reason-hwang/bff-apps test:filing-routes:e2e`: 48 requests/tests/assertions PASS 및 추가 HTTP/DB 범위 검증 PASS. 로그 bruno-api-tests/reports/filing-routes.log.
- `pnpm --filter @reason-hwang/bff-apps lint`: PASS. 최신 build 후 `node --test tests/*.test.cjs`: 17 PASS.
- 공개 Bruno `04-backfill-jobs/01-start-backfill-job.bru`: 소유 fixture HTTP에 1 request/test/assertion PASS.
- VAL-BROWSER-001: Playwright MCP Swagger Try it out→Execute, 티커 대상 5개, filingsUpserted=2, downloaded=2, failed=0, completed 확인. 공백 ticker의 ZIP 2개는 제외. `.playwright-mcp/ticker-only-backfill.yml` 증거. fixture 서버·DB는 검증 후 종료/삭제.
- 관련 스킬: apb-bruno-api-tests, supabase-postgres-best-practices. 실제 SEC 백필 재실행은 검증 대상이 아님.
