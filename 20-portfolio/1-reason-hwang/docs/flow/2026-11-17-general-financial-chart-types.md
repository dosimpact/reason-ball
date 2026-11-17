# 2026-11-17 일반 금융 시리즈 차트

- 결정: OPENUI-FIN-SERIES-001.
- 요청: Candlestick, Line, Area, Baseline, Histogram, Two price scales와 공통 Series markers / Price lines를 일반화된 Generative UI로 제공하고 financial 내부를 다시 분류한다.
- 설계: 기존 신뢰된 TA snapshot 차트와 별도로 `FinancialSeriesChart(config)`를 제공한다. 임의 지표·가격·거래량을 구성하는 series 목록이 핵심이다. 5개 type, 시리즈별 left/right 축, markers, priceLines를 조합한다. 두 가격 축을 여섯 번째 type으로 중복 구현하지 않는다. 스칼라 지표는 OHLC 없이 표시하며 계산·조회는 하지 않는다.
- 기존 FinancialChart/Plot/Summary/Metadata와 Query 계약을 보존한다. 다른 세션의 금융 블록 분리 및 관련 없는 변경을 보존한다.
- 금융 탭 하위: 기본 차트 유형 / 축·마커·기준선 / 시리즈 조합 / 기존 금융 컴포넌트·TA 쇼케이스.
- 공식 근거: [Line](https://tradingview.github.io/lightweight-charts/examples/series-types/line), [Markers](https://tradingview.github.io/lightweight-charts/docs/api/functions/createSeriesMarkers). 최신 웹 문서는 5.3이므로 실제 구현은 설치된 5.1.0 타입과 실행으로 확인한다.
- Stock: [Host Storybook](../stock/tech-shared/1-fe-host/storybook.md#openui-fin-series-001-일반-시리즈-차트).

## 검증

- VAL-VIEW-001: `pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/_pages/generative-ui/ui/Catalog.stories.tsx src/shared/ui/intelligent-ui/components/financial/series-chart/financial-series-chart.stories.tsx`: 19 PASS. 5종·두 축·line/candle/histogram 마커·가격선·지표 전용·빈 값·날짜 순서/형태/유한 수치 오류·로컬 dark 테마 포함.
- `pnpm -C 1-fe-host exec vitest run --project generative-ui`: 66 PASS. 신규 범용 DSL 9개 parser/schema 포함.
- `pnpm -C 1-fe-host typecheck`, 변경 파일 scoped ESLint: PASS.
- `pnpm -C 1-fe-host sec-ui:generate` 및 `openui:check`: 63 components, FE prompt/spec/Python mirror 일치.
- VAL-BROWSER-001 추가 확인: 공유 MCP는 프로필 사용 중 오류라 기존 사용자 브라우저를 건드리지 않았다. 캐시된 공식 @playwright/mcp CLI를 `--isolated --headless` stdio JSON-RPC로 직접 시작해 작업 전용 MCP/브라우저를 생성했다. owned Storybook6017의 Catalog에서 실제 링크 클릭으로 8개 예제를 전환하고 각각 canvas 렌더링·alert 0·pageerror 0을 확인했다. 모바일390px documentWidth390. fixture 실행이며 외부 시세 연동 검증은 아니다.
- 첫 MCP 시도에서 탐색 링크의 개수 표기가 접근성 이름에 포함되는 것을 확인했다. Story의 정확한 이름 일치 조건을 수정하고 Catalog4개 재실행 PASS. 후속 MCP8개 PASS. 브라우저 콘솔의 favicon404와 기존 Next runtime config 경고는 차트 오류와 구분했다.
- 증거: `.tmp/financial-series-desktop.png`, `.tmp/financial-series-mobile.png`, `.tmp/financial-series-mcp/console-2026-11-17T14-15-33-543Z.log`. 실행 증거는 로컬 제외 경로에 유지한다.
- 정리: MCP browser_close 후 stdio 종료, 두 번의 전용 MCP 프로세스 정상 종료0. Storybook session99836 Ctrl-C 종료. 기록 PID78405/78417/79011/79012 및 최종 vitest·playwright_chromiumdev_profile·financial-series-mcp 잔존 없음,6017 리스너 없음. 사용자 Chrome/공유 MCP/다른 서버 유지.
- 구현은 Sol 서브에이전트가 범용 schema·renderer·fixtures·stories를 담당하고 parent가 catalog·prompt·문서 및 통합 검증을 담당했다.
- 스킬: [apb-playwright-e2e](/Users/studio/workspace/projects/reason-ball/.codex/skills/apb-playwright-e2e/SKILL.md)의 MCP 검증/정리 절차를 적용했다.
