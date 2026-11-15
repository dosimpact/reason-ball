# SEC Collector 프런트 UX 정리

- 배경: 수집 확인·작업 결과·선택 대상·API Testing 응답의 관계를 사용자에게 명확히 한다.
- 변경: 확인 조건 요약과 접힌 JSON, 최근 작업별 실제 수치와 세션 안내, 선택 기업 유지·해제, 조회 시각·오류·재시도·초기화, 동기화 용어와 진입점 정리, 원문/XBRL 구분과 지원 안내, API Testing 요청별 복사와 전송 출처 표시, 4개 통계 배치와 접힌 상세, 접근성 이름·모바일 스크롤을 제공한다. 기존 서버 필터와 API를 사용한다.
- Stock: [Collector 설계](../stock/us-corporate-filings/collector-dashboard.md), [Host 구조](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md).
- 검증: Host typecheck PASS, 변경 UI/model 파일 ESLint PASS, diff check PASS. 브라우저와 Storybook 실행은 사용자 요청에 따라 생략했으며 사용자 확인 대기 중이다. 서버나 환경을 변경하거나 재시작하지 않았다. 테스트 자원은 생성하지 않았다.
