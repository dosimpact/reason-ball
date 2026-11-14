# OPENUI-CATALOG-CHART-001: TradingView 차트 카탈로그 예제

- 날짜: 2026-11-14
- 요청: FE OpenUI Lang 카탈로그에 TradingView 차트 추가.
- 원인: FinancialChart는 공유 library에 등록됐지만 카탈로그 stories.json에 항목이 없어 메뉴·검색에 나타나지 않음.
- 변경: 미디어·데이터 그룹에 FinancialChart 항목과 가상 스냅샷 예제 3개(전체 지표/가격·거래량/빈 데이터) 추가. TradingView 검색 설명과 코드 편집·초기화 제공. 외부 데이터/모델 호출 없음.
- Stock: [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md#openui-catalog-chart-001-tradingview-차트-카탈로그) 동기화.
- 검증: VAL-VIEW-001 Storybook에서 FinancialChart 직접 링크 진입·TradingView 검색→실제 차트 canvas→빈 상태→코드 적용·초기화 확인. 결과는 아래 기록. API·서버 업무 로직 변경 없음.

- 결과: `pnpm -C 1-fe-host test:generative-ui:views` 3개 Story 파일/4개 테스트 PASS. 캔들·지표/가격 전용 두 canvas 영역과 빈 데이터 상태, 예제 코드 적용·초기화 확인.
- 정적 검증: `pnpm -C 1-fe-host typecheck`, 새 Story의 ESLint, scoped diff 공백 검사 PASS.
- 재시도: 초기 Story 테스트의 브라우저 연결 종료 후 직접 링크 진입 방식으로 검증을 안정화. 초기 타입 검사에서 잘못된 Testing Library 옵션을 제거한 뒤 재실행 PASS. 미통과 결과를 PASS로 집계하지 않음.
- 정리: 각 테스트 runner 정상 종료, 소유 브라우저는 runner가 정리. 개발 서버·공유 MCP/브라우저·임시 프로필을 따로 생성하지 않음. 관련 없는 로컬 변경은 보존.
