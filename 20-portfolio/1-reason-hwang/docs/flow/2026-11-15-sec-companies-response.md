# SEC-COMPANIES-RESPONSE-001 기업 목록 응답 정리

- 배경: 기업 조회의 최상위 filters가 요청 조건을 중복 반환했다. 응답은 pagination과 items만 제공한다. 쿼리 검증 및 검색·정렬·페이지네이션은 유지한다.
- 변경: 컨트롤러와 Swagger 응답 DTO에서 filters를 제거하고, Host 기업 목록 응답 타입과 Storybook fixture를 분리했다. 화면의 companyFilters는 요청 조건과 디버깅 용도로 유지한다. LangGraph 전체 검색 결과 기업 응답 filters 의존성은 발견되지 않았다.
- Stock: [SEC 시스템 설계](../stock/us-corporate-filings/system-design.md), [BFF API 명세](../../2-bff-apps/src/us-corporate-filings/.docs/api-spec.md).
- VAL-API-001: Given 격리 PostgreSQL fixture, When 기업 목록의 필터·페이지·limit·경계·잘못된 입력을 HTTP 요청, Then 응답 키와 결과·상태가 계약에 맞음. `pnpm --filter @reason-hwang/bff-apps test:companies:e2e` PASS 28/28, Swagger schema PASS. 로그 `2-bff-apps/bruno-api-tests/reports/company-pagination.log`. 실행 중 DB 연결 재시도 후 성공했다.
- Host `pnpm --filter @reason-hwang/fe-host typecheck` PASS. 기업 목록·통계·페이지 이동·API Testing·디버그는 코드 경로와 타입을 확인했으나 실제 브라우저 검증은 미실행이므로 사용자 동작 검증은 미완료다. 순수 View 구현 변경은 없어 VAL-VIEW-001은 해당 없음.
- 자원: 테스트 소유 임시 PostgreSQL 컨테이너와 Nest fixture 서버는 스크립트가 종료했다. 포트 62812와 sec-company-test 컨테이너가 남지 않았음을 확인했다. 기존 서버는 유지했다.
