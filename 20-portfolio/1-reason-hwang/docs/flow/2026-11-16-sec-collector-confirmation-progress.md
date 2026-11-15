# SEC 수집 확인과 진행 표시

- 배경: 확인 후 입력 변경 시 이전 조건 실행, 결과가 디버깅에만 표시, 실패한 기업 조회에서 이전 결과 선택 가능.
- 변경: 확인 조건 또는 선택 기업 변경 시 확인을 무효화하고 대상·기간·원문 저장 여부를 표시한다. 일괄 수집 대상과 SSE 진행·종료 상태를 기본 화면에 표시한다. 기업 조회 조건이 일치하고 정상 응답한 결과만 선택할 수 있으며, 통계 마지막 성공 시각과 갱신 실패 상태를 표시한다.
- Stock: [SEC Collector](../stock/us-corporate-filings/collector-dashboard.md).
- 검증: Host typecheck와 변경 파일 ESLint PASS, SEC collector 단위 11/11 PASS. Storybook fixture 상호작용 2/2 PASS (선택 수집과 확인 무효화). Playwright MCP로 격리 Storybook 화면 접근했으나 사용자 관점 전체 흐름 검증은 수행하지 않아 미완료다. 기존 다른 Storybook 시나리오는 실행하지 않았다.
- 정리: Storybook 검증 서버 16356을 종료하고 Playwright MCP 페이지를 닫았다. 서버 포트 잔존 여부 확인.
