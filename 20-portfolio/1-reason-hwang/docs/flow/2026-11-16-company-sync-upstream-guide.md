# SEC-API-DOC-002: 기업 동기화 upstream 스키마 안내

- 날짜: 2026-11-16
- 요청: 지정한 human-docs SEC 수집 가이드의 기업 주소록 동기화 항목에 upstream API 형태·스키마 추가.
- 권한: 최신 사용자 요청을 해당 항목의 human-docs 편집 예외로 적용. 다른 본문·기존 staged 변경 보존.
- 변경: SEC company_tickers.json GET URL/헤더/객체 응답/TypeScript 스키마/DB 매핑, CIK 중복 제거와 syncedCount 의미, SIC null 저장 및 목록 범위 제한 설명.
- 근거: CompanyService/CompanyTickerRecord/SecClient 코드와 SEC 공식 EDGAR 안내·원본 JSON 대조.
- Stock: [수집 시스템](../stock/us-corporate-filings/system-design.md)의 기존 기업 동기화 계약 설명만 보충. 현재 동작·설계 변경 없음.
- 검증: JSON 예제 파싱·Markdown fence/공백·다른 섹션 prefix/suffix 보존 PASS. 실행 요청/DB 변경 없음.
- 자원: 서버·브라우저·임시 자원 생성 없음.
