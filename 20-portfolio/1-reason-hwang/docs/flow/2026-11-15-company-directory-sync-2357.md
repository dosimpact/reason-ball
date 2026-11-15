# SEC 기업 주소록 수동 동기화

- 일시: 2026-11-15 23:57 KST (응답 requestedAt: 2026-11-15T14:57:14.861Z)
- 요청: 사용자가 POST /api/sec/company-sync-jobs 1회 실행을 명시 요청.
- 실행: 로컬 BFF 2980에 빈 JSON body와 x-request-id=company-sync-20261115-manual 전송.
- 결과: HTTP 201, job=companies:sync, syncedCount=7997. 신규 삽입 수가 아니라 이번 동기화 처리 건수.
- 조회 확인: GET /api/sec/companies?page=1&pageSize=1 → HTTP 200, pagination.totalItems=8557, 기업 항목 반환 확인. 전체 건수는 이번 처리 건수와 다른 집계이며 기존 DB 행을 포함할 수 있음.
- 범위: 기업 주소록 동기화만 수행. 공시 메타데이터/원문 수집 요청 없음. 서버·브라우저·임시 자원 생성 없음.
- Stock: [공시 시스템](../stock/us-corporate-filings/system-design.md)의 기존 기업 upsert/조회 계약 실행. 설계·코드 변경 없음.
