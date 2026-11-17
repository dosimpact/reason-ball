# 2026-11-17 OpenUI Lib Story 금융 예제 보완

- 결정: OPENUI-FIN-STORY-002. 사용자가 새 financial 기능이 OpenUI Lib Story에서 보이지 않는다고 보고했다.
- 원인: 기존 금융 차트 5개는 등록됐으나 v2 다중 지표와 IndicatorControls는 앱 내부 예제 목록에 없었다. 별도 Storybook에는 일부 예제가 존재했다.
- 변경: SMA 다중 설정, BBANDS·PSAR, 준비 구간·지표별 오류, IndicatorControls를 추가했다. 금융 예제 9개. 컴포넌트 그룹 중복을 방지하고 검색에 signature/id를 포함했다. 모든 데이터는 가상이며 축소 SMA catalog의 적용은 로컬 상태만 변경한다.
- Stock: [Host Storybook](../stock/tech-shared/1-fe-host/storybook.md#openui-fin-story-002-lib-story-금융-v2-예제).

## 검증

VAL-VIEW-001 대상의 카탈로그 View/fixture 보완이다. 서버 API나 업무 계산 변경은 없다.

- `pnpm -C 1-fe-host exec vitest run --project generative-ui src/_pages/generative-ui/ui/catalog/financial-stories.test.ts`: PASS 1. 9개 DSL parser 및 차트 snapshot 계약 확인.
- `pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/_pages/generative-ui/ui/Catalog.stories.tsx`: 최종 PASS 3. Chromium에서 기존 TradingView 편집/초기화, 기존 금융 조합, 신규 v2/지표 설정 검증. hash 탐색은 테스트 runner 연결을 유지하도록 history/hashchange로 재현했다.
- 첫 Storybook 실행은 브라우저 연결 종료로 중단. 이후 테스트의 예상 오류 alert와 비동기 heading 대기 조건을 수정하고 전체 3개 재실행 통과.
- `pnpm -C 1-fe-host typecheck`: PASS.
- 변경된 Catalog.stories.tsx, financial-stories.ts, financial-stories.test.ts, lib-story.tsx의 scoped ESLint: PASS.
- 정리: Vitest 소유 Chromium 및 Vite는 runner 종료로 정리. 종료 후 `ps`에서 vitest와 playwright_chromiumdev_profile 잔존 없음. 사용자 Chrome·공유 MCP·기존 개발 서버는 사용하거나 종료하지 않았다. 추가 서버·임시 데이터 없음.
