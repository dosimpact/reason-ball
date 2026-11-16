# Lib Story 금융 차트 쇼케이스

- 배경: FinancialChart의 캔들·거래량 및 주요 지표 구성을 따로 탐색하기 어려웠다.
- 변경: 컴포넌트 목록에 금융 차트 쇼케이스 그룹을 추가해 캔들·거래량, SMA(20), RSI(14), MACD(12,26,9), 통합 화면을 각각 제공한다. 독립 컴포넌트가 아닌 기존 FinancialChart 구성이며 예제는 가상 시세와 표시 확인용 지표를 사용한다.
- Stock: [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md).
- 검증: Host typecheck 및 변경 파일 ESLint PASS. 다섯 스냅샷의 schema·지표 구성·OpenUI parser 단위 테스트 PASS. Storybook 탐색 시나리오를 추가했으며 기존 사용자 요청에 따라 브라우저 실행은 하지 않았다. 초기 단위 테스트 실행은 Vite JSX 변환 설정과 직접 라이브러리 import 충돌로 실패했고, 생성된 카탈로그 spec을 사용하도록 수정 후 통과했다.
