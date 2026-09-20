# 최종 BFF 계약 Bruno 동기화

- 날짜: 2026-09-20, BFF-DIR-001 / SEC-AMEND-001.
- 요청: 사용자 지정 bruno-api-tests를 최종 구현에 맞춰 갱신.
- 변경: SSE Accept 헤더, 마지막 completed 및 failed=0 검사, 메타데이터-only 요청, 원본·수정본 원문 및 10-K/A 조회 요청, collection 안내와 README 정리. 사용자 local 환경/회사 요청 수정은 보존.
- 검증 중 발견: Bruno CLI 4.1.0에서 params:query만 작성한 URL이 query 없이 전송됐다. URL에도 명시해 수정하고 재검증.
- 실행: 소유한 fixture 서버 127.0.0.1:54436, 실제 Nest/PostgreSQL, SEC만 fixture. 공개 컬렉션에서 CLI run 02-filing-jobs 04-backfill-jobs: 3 requests/tests/assertions PASS. run 03-filings(CIK6 수정본 fixture): 3 requests/tests, 18 assertions PASS. 총 6 requests/tests, 21 assertions PASS.
- 초기 query 누락 실패는 수정 후 해소. 실행 위치 오류 한 번은 collection root로 수정. 기존 실데이터 백필은 중복 시작하지 않음.
- 적용 스킬: apb-bruno-api-tests. API 구현/화면 동작 변경 없음, 브라우저 재검증 대상 아님.
- stock: [도메인 시스템 설계](../stock/us-corporate-filings/system-design.md).
