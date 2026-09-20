# SEC BFF Bruno requests

현재 업무 API 5개를 반영한다. 회사 페이지네이션, SSE 백필, 원본·수정본 연결 조회를 포함한다.

- `01-companies`: 전체 회사 동기화, 회사 목록·페이지 조회 (최대 100000).
- `02-filing-jobs`: 특정 기업 메타데이터→원문 SSE, 메타데이터만 수집하는 변형.
- `03-filings`: 공시 목록, 원본·수정본 원문, 10-K/A 연결 조회.
- `04-backfill-jobs`: 전체 기업 백필 SSE. 기본 20년, 원문 포함.

`pnpm --filter @reason-hwang/bff-apps bruno`로 연다. local 환경의 baseUrl/sampleCik/sampleTicker를 확인한다. 사용자 환경값은 보존했다.

백필은 `Accept: text/event-stream`, HTTP 200이다. 완료 응답의 마지막 이벤트가 completed이고 failed=0이어야 전체 성공이다. error나 failed>0이면 원문 수집이 미완료다. `downloadDocuments=false`는 메타데이터만 적재한다. 진행 중인 대량 백필을 확인하려고 시작 요청을 다시 실행하지 않는다.

공시 조회는 includeAmendments=true가 기본이다. 각 항목의 original, amendments, amendmentLinkStatus를 확인한다. 수정본이 원본 전체를 대체한다고 가정하지 않는다. includeContent=true는 각 원문을 별도로 포함하며 자동 병합하지 않는다. 페이지 번호는 검색된 공시 행 기준이다. 원본 후보가 없거나 모호하면 original=null이다.

구형 상태 조회·다운로드·재시도·parser-status 요청은 제거했다. 이전 환경의 backfillRunId 등 미사용 변수는 요청에서 참조하지 않는다.

격리 HTTP 회귀: `pnpm --filter @reason-hwang/bff-apps test:filing-routes:e2e` (SEC fixture + 임시 PostgreSQL). 실제 전체 백필은 `data/runs/20-year-backfill.log`를 확인한다.
