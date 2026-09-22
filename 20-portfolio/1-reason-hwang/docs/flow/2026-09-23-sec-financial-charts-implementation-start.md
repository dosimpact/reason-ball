# SEC 재무 차트 구현 착수

- 날짜: 2026-09-23
- Scope: us-corporate-filings / tech-shared A2UI; 1-fe-host, 3-langgraph-fast
- 상태: 구현 및 검증 진행 중. 완료 기록이 아님.
- 기준: [설계](../stock/tech-shared/a2ui-system/sec-financial-charts.md), SEC-CHART-001~006.

원문 HTML 표의 셀 좌표·병합 헤더를 보존하는 파서와 source reference 기반 추출 계약을 추가했다. Beautiful Soup을 명시 의존성으로 등록했다. 기존 일반 Chart를 보존하고 FinancialChart 6종을 SEC/Host에 등록했으며 해당 catalogId는 1.1.0으로 갱신했다. Dynamic/Fixed 카탈로그 ID는 유지한다. 실제 서버 숫자에서 props를 구성하는 렌더 도구를 기존 SEC 에이전트에 연결하고 페이지에 프롬프트 안내를 추가했다.

실제 쿠팡 2026-02-26 제출 10-K(0001834584-26-000024)의 312개 표/59개 섹션 색인을 확인했다. 첫 실모델 추출은 연도만 반환한 날짜 형식 때문에 실패했다. YYYY-MM-DD 계약과 표 직전의 날짜 문맥 보존을 추가했다. 목차는 섹션→표로 계층 탐색하도록 조정했다. 수정 후 원문 table-169의 2023/2024/2025 매출 24,383/30,268/34,534 및 영업이익 473/436/473(USD millions)의 6개 관측치를 검증했다. 이 수치는 해당 선택 문서의 데이터이며 테스트용 고정 모델 출력이 아니다.

현재 증거: 파서/차트 적합성/카탈로그 Python 27 PASS, A2UI 경유 Storybook 102 PASS. Storybook 첫 실행의 12개 실패는 과거 SEC fixture의 catalogId 1.0.0을 1.1.0으로 갱신한 후 해소됐다. TypeScript story 옵션 오류 수정 후 재검증 예정. 전체 Python lint에서 신규 및 기존 경고가 발견되어 범위를 확인하며 수정 중이다.

실제2820 페이지의 MCP 탐색에서 프롬프트 안내와 회사/공시 선택, 재무 읽기 진행을 확인했다. 차트 E2E/Bruno/실제10-Q/출력 수명/실패 경로 및 자원 정리 증거는 아직 완료하지 않았다. 현재 stock의 미구현 표시는 최종 검증 후 구현 상태로 동기화할 예정이다. 테스트 브라우저는 작업 소유이며 완료 시 정리한다. 기존2820/8000/2801 서비스는 유지 대상이다. 사용자 demo.tsx 너비 변경을 보존하며 커밋에서 해당 hunk를 제외한다.
