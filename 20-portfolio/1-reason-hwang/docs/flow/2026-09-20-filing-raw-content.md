# SEC-CONTENT-001: 단일 공시 원문 직접 조회

- 날짜: 2026-09-20
- 범위: us-corporate-filings / 2-bff-apps
- 요청: CIK+접수번호로 JSON 대신 HTML/XML/text 원문을 직접 반환.
- 결정: 기존 controller/DTO/FilingService에 GET /filings/:cik/:accessionNo/content 추가. 새 모듈·Entity·migration 없음. 저장된 다운로드 완료 본문만 조회하며 SEC 추가 요청 없음.
- 계약: 200 원문 UTF-8, 400 식별자 형식 오류, 404 복합 키 불일치, 409 pending/failed/본문 없음. 알려진 MIME만 사용하고 그 외 text/plain. CSP sandbox·nosniff·inline으로 브라우저 표시. 외부 자원 차단으로 원본 사이트와 표현이 다를 수 있음.
- stock 반영: [도메인 설계](../stock/us-corporate-filings/system-design.md#sec-content-001-단일-원문-직접-조회), [디렉터리 정책](../stock/tech-shared/2-bff-apps/directory-policy.md), BFF API 명세, Swagger 가이드와 API 개수 안내. 공개 Bruno에 05-raw-content 및 accessionNo 변수 추가. 사용자 기존 환경/회사 요청 변경 보존.

## 시나리오와 검증

- VAL-API-001: 저장된 HTML/XML/plain/XHTML/알 수 없는 MIME이 있을 때 직접 조회하면 정확한 MIME 및 원문 반환. pending/failed는 409, 존재하지 않거나 다른 CIK이면 404, 잘못된 식별자는 400.
- pnpm --filter @reason-hwang/bff-apps lint: PASS.
- pnpm --filter @reason-hwang/bff-apps test: 17 PASS.
- BRUNO_CLI=<installed CLI> pnpm --filter @reason-hwang/bff-apps test:filing-routes:e2e: 48 requests/tests/assertions PASS. 새 원문 시나리오 11개. 임시 PostgreSQL+실제 Nest HTTP, 외부 SEC만 fixture. 로그: 2-bff-apps/bruno-api-tests/reports/filing-routes.log (gitignored).
- VAL-BROWSER-001: Playwright MCP browser_navigate/browser_snapshot으로 소유 fixture 서버 원문 URL 직접 열기. HTML 한글 heading 표시 및 악성 테스트 script 차단, XML 트리/한글 표시, 미다운로드 409 JSON 표시 확인. script 차단 콘솔 오류는 의도된 CSP 동작. 실제 SEC 원문 실연동 테스트가 아닌 fixture 검증.
- 브라우저 증거: 2-bff-apps/.playwright-mcp/raw-filing-{html,xml,pending}.yml (gitignored).
- 스킬: apb-bruno-api-tests (기존 컬렉션 확장/실행), supabase-postgres-best-practices (읽기 전용 집계).

## 요청된 MIME 통계

2026-09-20 22:57 KST 실DB 읽기 전용 GROUP BY status, document_content_type 결과: 총 2,204,809건, downloaded 3,563건 중 text/html 3,511 (98.54%), text/plain 52 (1.46%), XML 0. pending 2,201,246. 수집 중 시점 통계이며 전체 SEC의 분포를 의미하지 않는다. 원문 본문이나 자격증명은 로그로 출력하지 않음.

공개 Bruno `03-filings/05-raw-content.bru`도 소유 fixture에 실행하여 1 request/test/assertion PASS.
