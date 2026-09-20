# SEC BFF Bruno requests

현재 업무 API 6개를 반영한다. 회사 페이지네이션, SSE 백필, 원본·수정본 연결 조회를 포함한다.

- `01-companies`: 전체 회사 동기화, 회사 목록·페이지 조회 (최대 100000).
- `02-filing-jobs`: 특정 기업 메타데이터→원문 SSE, 메타데이터만 수집하는 변형.
- `03-filings`: 공시 목록, 원본·수정본 원문, 10-K/A 연결 조회.
- `04-backfill-jobs`: 전체 기업 백필 SSE. 기본 20년, 원문 포함.

`pnpm --filter @reason-hwang/bff-apps bruno`로 연다. local 환경의 baseUrl/sampleCik/sampleTicker를 확인한다. 사용자 환경값은 보존했다.

백필은 `Accept: text/event-stream`, HTTP 200이다. 완료 응답의 마지막 이벤트가 completed이고 failed=0이어야 전체 성공이다. error나 failed>0이면 원문 수집이 미완료다. `downloadDocuments=false`는 메타데이터만 적재한다. 진행 중인 대량 백필을 확인하려고 시작 요청을 다시 실행하지 않는다.

공시 조회는 includeAmendments=true가 기본이다. 각 항목의 original, amendments, amendmentLinkStatus를 확인한다. 수정본이 원본 전체를 대체한다고 가정하지 않는다. includeContent=true는 각 원문을 별도로 포함하며 자동 병합하지 않는다. 페이지 번호는 검색된 공시 행 기준이다. 원본 후보가 없거나 모호하면 original=null이다.

구형 상태 조회·다운로드·재시도·parser-status 요청은 제거했다. 이전 환경의 backfillRunId 등 미사용 변수는 요청에서 참조하지 않는다.

격리 HTTP 회귀: `pnpm --filter @reason-hwang/bff-apps test:filing-routes:e2e` (SEC fixture + 임시 PostgreSQL). 실제 전체 백필은 `data/runs/20-year-backfill.log`를 확인한다.

로컬 baseUrl은 `http://127.0.0.1:2801/api/sec`를 사용한다. 서버 기본 APP_HOST=0.0.0.0은 IPv4이며 localhost가 IPv6 ::1로 해석되면 ECONNREFUSED가 발생할 수 있다.

## 단일 원문 조회

`03-filings/05-raw-content.bru`: 목록에서 downloaded 공시의 cik/accessionNo를 골라 환경의 sampleCik/accessionNo에 설정한 후 실행한다. HTML/XML/text를 JSON 없이 반환한다. 초기 accessionNo는 교체가 필요한 placeholder다.

전체 기업 백필은 DB ticker가 비어 있지 않은 회사만 대상으로 한다. 회사 동기화 후 실행하며, 기존 티커 없는 공시는 삭제하거나 다운로드하지 않는다.

## SEC-QUERY-TICKER-001: 목록 조회의 기본 범위

GET /companies와 GET /filings는 DB companies.ticker가 NULL·빈 문자열·공백이 아닌 회사만 반환한다. 별도 파라미터 없이 기본 적용하며 cik/ticker/q 등 기존 필터와 AND로 결합한다. totalItems/totalPages에도 동일 조건이 적용된다. 티커 없는 회사 CIK를 지정하면 빈 목록이다. 회사 데이터나 공시를 삭제하지 않으며 현재 상장 여부를 의미하지 않는다. CIK+accessionNo로 이미 저장된 단일 원문을 조회하는 API는 이 목록 필터와 별개로 유지한다.
