# SEC-API-DOC-001: SEC 수집 API 학습 가이드

- 날짜: 2026-11-15
- 요청: 지정한 `docs/human-docs/1-sec-수집/1-sec-수집.md`의 API Listing에 설명·가능한 요청·간단한 응답 스키마 추가.
- 권한: 최신 사용자 명시 요청에 따라 해당 문서의 API Listing 구간에만 human-docs 편집 예외 적용. 나머지 본문과 다른 사용자 파일 보존.
- 변경: 기존 6개 API의 path/body/query/header, 기본값·범위·선택 옵션, JSON/페이지/SSE/원문 응답과 오류 정리. 현재 추가된 단일 원문 다운로드 API는 참고로만 표시.
- 근거: 현행 controller, DTO/검증 pipe, CompanyService/FilingService/FilingBackfillService, entity 대조. 선택 기업 refreshArchive 미사용·전체 수집 티커 조건·SSE HTTP 200 내 error·수집 완료와 원문 일부 실패 구분 명시.
- Stock: [수집 시스템 설계](../stock/us-corporate-filings/system-design.md), [BFF API 원본](../../2-bff-apps/src/us-corporate-filings/.docs/api-spec.md)의 기존 계약을 학습 문서로 설명. 동작·현행 설계 변경 없음, stock 추가 수정 불필요.
- 검증: API Listing 밖 prefix/suffix 동일, JSON 예제 파싱, 링크 존재와 문서 구조·공백 검사 PASS. 코드 변경 및 실제 수집 요청 없음. VAL-API/VIEW/BROWSER 실행 검증 적용 대상 아님.
- 정리: 서버·브라우저·임시 자원 생성 없음. 기존 staged 변경 보존.
