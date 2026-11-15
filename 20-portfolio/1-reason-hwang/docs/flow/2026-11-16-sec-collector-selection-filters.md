# SEC Collector 선택 및 공시 탐색 개선

- 맥락: 선택한 기업 수집으로의 이동, 특정 공시 검색과 원문·XBRL 접근을 연결한다.
- 변경: 선택 기업 작업 바에 대상 목록·개별 해제 및 수집 설정 이동을 추가했다. 기업별 공시에서 양식·제출일 범위·실제 원문 보유 여부로 서버 필터링한다. 원문 보기와 XBRL 보기를 구분하고 오류 사유·재시도를 표시한다. 동기화와 원문 저장 용어를 통일했다.
- API: GET /filings의 `until`은 제출일 종료일 포함, `hasContent`는 실제 원문 존재 여부로 페이지네이션 전에 필터링한다. 기존 API 기본값은 유지한다.
- Stock: [Collector](../stock/us-corporate-filings/collector-dashboard.md), [API](../../2-bff-apps/src/us-corporate-filings/.docs/api-spec.md).
- 검증: 격리 PostgreSQL/Nest Bruno 54/54 PASS (새 필터 2건 포함). Storybook 선택·필터와 확인 무효화 2/2 PASS; Host 타입 검사와 변경 파일 ESLint, BFF lint PASS. Playwright MCP로 Storybook fixture 페이지를 열었으나 실제 앱 사용자 흐름 전체 검증은 미완료다. 선택 항목의 여러 페이지 지속 및 서버 통합 UI는 별도 검증이 필요하다.
- 자원: 검증 소유 임시 DB·Nest 서버와 Storybook 포트 16356을 종료하고 Playwright 페이지를 닫았다. 포트 및 컨테이너 잔존을 확인했다.
