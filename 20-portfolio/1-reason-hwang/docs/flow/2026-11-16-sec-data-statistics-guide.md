# SEC 데이터 통계 문서 보충

- 날짜: 2026-11-16
- 요청: SEC 수집 human-docs의 데이터 통계 두 항목을 간단히 작성. 최신 사용자 요청으로 해당 구간만 편집.
- 내용: 앞서 실제 API 조회한 전체 기업 982260/티커 보유 8557/미보유 973703, Apple 공시 275건과 유형별 건수 정리. 조회일·DB 저장 기준·수정본 별도 집계·원문 수집과 구분 명시.
- 근거: 같은 대화의 GET /api/sec/overview 및 GET /api/sec/filings?ticker=AAPL 조회 결과. 신규 수집 요청 없음.
- Stock: [공시 시스템](../stock/us-corporate-filings/system-design.md) 계약 변경 없음. 시점별 통계만 기록.
- 검증: 합계/차감 계산, 통계 구간 밖 본문 보존 PASS. 서버·브라우저·임시 자원 생성 없음.
