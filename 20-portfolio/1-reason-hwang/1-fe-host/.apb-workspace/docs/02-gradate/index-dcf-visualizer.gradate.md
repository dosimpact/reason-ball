# index-dcf-visualizer Gradate

## Design

### User outcome

GET /index-dcf-visualizer는 합성 Demo preset으로 즉시 계산 가능한 Index DCF Flow를 제공한다.
사용자는 slider와 숫자 입력으로 5년 성장·환원·할인·장기 가정을 바꾸고, 영향을 받는 계산 노드와 Current/Fair 비교 차트를 같은 화면에서 확인한다.

### Design principles

- Formula first: 계산·검증·format을 React에서 분리한다.
- Partial availability: 한 입력 오류가 무관한 상위·형제 노드를 숨기지 않는다.
- One-way state: raw input → validation snapshot → calculation graph → formatted UI.
- No stale result: Error의 영향을 받는 하위 노드는 이전 숫자 대신 Calculation unavailable을 렌더한다.
- Accessible by construction: native form semantics, keyboard controls, DOM result text와 SVG description을 사용한다.
- Local scope: 1-fe-host 내부만 변경하고 새 dependency와 root lockfile 변경을 금지한다.

## Implementation Draft

### Architecture Overview

~~~text
Next.js Server Route
  src/app/index-dcf-visualizer/page.tsx
        |
        v
Client Business Widget
  src/widget/index-dcf/IndexDcfVisualizer.tsx
        |
        +--> DcfInputState (raw strings + linked toggle)
        |
        +--> validateIndexDcf(inputState)
        |      └--> field values + structured Error/Warning issues
        |
        +--> calculateIndexDcf(validationSnapshot)
        |      └--> dependency-aware NodeResult graph
        |
        +--> semantic Step 1~5 UI
               ├--> assumptions controls
               ├--> Y1~Y5 forecast table/cards
               ├--> discount and terminal nodes
               ├--> fair value composition
               └--> accessible Current/Fair SVG chart
~~~

### React Directory Policy

- src/app은 Next.js App Router의 framework-required exception이다.
- 기존 src/components, src/features, src/lib, src/shared는 legacy 구조이며 이번 범위에서 이동하거나 수정하지 않는다.
- 신규 domain-aware UI는 canonical widget 책임에 맞춰 src/widget/index-dcf에 둔다.
- 신규 framework-agnostic 계산·검증·format은 src/utils/index-dcf에 둔다.
- Demo preset과 input constraints는 src/constants/index-dcf.ts에 둔다.
- generic element를 새로 만들지 않고 기존 src/components/ui의 Card, Badge, Button, Input을 재사용한다.

### Modules

| Module | Responsibility | Public surface |
|---|---|---|
| src/app/index-dcf-visualizer/page.tsx | Server route, metadata, widget mount | default Page |
| src/constants/index-dcf.ts | five-year constants, constraints, Demo raw preset | FORECAST_YEARS, INPUT_CONSTRAINTS, DEMO_INPUT |
| src/utils/index-dcf/types.ts | raw state, issue, validation and node graph types | DcfInputState, ValidationIssue, NodeResult, DcfResult |
| src/utils/index-dcf/validate-index-dcf.ts | raw parse, range and cross-field validation | validateIndexDcf |
| src/utils/index-dcf/calculate-index-dcf.ts | EPS, payout, PV, terminal, fair and comparison graph | calculateIndexDcf |
| src/utils/index-dcf/format-index-dcf.ts | index point, percentage, delta and issue formatting | formatIndexPoints, formatPercent, formatSignedPercent |
| src/widget/index-dcf/IndexDcfVisualizer.tsx | client state, reset, r_long link transitions and composition | IndexDcfVisualizer |
| src/widget/index-dcf/AssumptionsPanel.tsx | context fields and grouped slider+number inputs | AssumptionsPanel |
| src/widget/index-dcf/AssumptionControl.tsx | domain-labelled native range and raw number pair | AssumptionControl |
| src/widget/index-dcf/ForecastSection.tsx | semantic desktop table and responsive year cards | ForecastSection |
| src/widget/index-dcf/DiscountTerminalSection.tsx | r, PV 5yr, Y6, payout, TV, PV(TV) and warnings | DiscountTerminalSection |
| src/widget/index-dcf/FairValueComposition.tsx | PV 5yr + PV Terminal and terminal share | FairValueComposition |
| src/widget/index-dcf/ValuationComparisonChart.tsx | accessible horizontal Current/Fair SVG and DOM metrics | ValuationComparisonChart |
| src/widget/index-dcf/IssueSummary.tsx | accessible Error/Warning aggregation | IssueSummary |
| tests/e2e/index-dcf-calculation.spec.ts | Node-only deterministic formula and policy tests | Playwright calculation project |
| tests/e2e/index-dcf-visualizer.spec.ts | desktop/mobile browser interaction tests | Playwright browser projects |

### Interfaces

~~~ts
type FiveYear<T> = readonly [T, T, T, T, T];

interface DcfInputState {
  indexName: string;
  valuationDate: string;
  actualEps: string;
  currentIndex: string;
  growthRates: FiveYear<string>;
  dividendPayouts: FiveYear<string>;
  buybackPayouts: FiveYear<string>;
  riskFreeRate: string;
  impliedErp: string;
  perpetualGrowth: string;
  normalizedRoe: string;
  useForecastDiscountRate: boolean;
  independentLongRunDiscountRate: string;
}

interface ValidationIssue {
  id: string;
  code: string;
  severity: "error" | "warning";
  fieldId?: string;
  nodeId?: string;
  message: string;
}

type NodeResult<T> =
  | { status: "available"; value: T; warningIds: string[] }
  | { status: "unavailable"; issueIds: string[] };

interface ValidationSnapshot {
  fields: Record<string, NodeResult<number | string | boolean>>;
  issues: ValidationIssue[];
}

function validateIndexDcf(input: DcfInputState): ValidationSnapshot;
function calculateIndexDcf(snapshot: ValidationSnapshot): DcfResult;
~~~

DcfResult는 forecastRate, Y1~Y5의 growth/eps/totalPayout/cashPayout/pv, pv5yr, Y6 EPS, long-run payout, cash payout Y6, TV5, PV Terminal, Fair Index와 comparison을 각각 NodeResult로 제공한다.

### Dependency-aware calculation

- Actual EPS 오류: 모든 EPS와 그 하위 cash/PV/terminal/fair 중단.
- Growth Yn 오류: 해당 연도부터 이후 EPS 중단. 이전 연도 결과 유지.
- Dividend 또는 Buyback Yn 오류: 해당 연도 Cash Payout/PV와 합계 PV 중단. EPS와 독립 Terminal branch는 유지.
- Risk-free 또는 ERP 오류: r과 forecast PV 중단. linked r_long이면 TV도 중단하고 independent면 TV5는 유지한다.
- g 또는 normalized ROE 오류: Y6 long-run payout 이후 중단. Y1~Y5 branch는 유지.
- independent r_long 오류: TV5 이후만 중단.
- Current Index 오류: Fair Index까지 유지하고 comparison만 중단.
- Warning은 NodeResult 값을 유지하면서 warningIds로 원인과 연결한다.

### Linked r_long state transition

- linked on: 유효한 r을 화면 r_long으로 사용하고 마지막 유효 r을 independent raw 값에도 동기화한다.
- linked 상태에서 r이 invalid면 r_long도 unavailable이지만 마지막 유효 independent raw 값은 보존한다.
- linked off: 마지막 동기화 raw 값을 독립 slider의 시작값으로 사용한다.
- off 상태에서 r 변경은 independent r_long을 바꾸지 않는다.
- 다시 on: independent 값 대신 유효한 r을 즉시 사용한다.

### Data Flow

1. DEMO_INPUT으로 DcfInputState를 초기화한다.
2. slider, number, text, date 또는 toggle 이벤트가 raw state 하나를 갱신한다.
3. validateIndexDcf가 필드 parse, min/max, r_long > g, g < normalized ROE와 warning 조건을 평가한다.
4. calculateIndexDcf가 dependency graph 순서로 각 NodeResult를 계산한다.
5. DEMO_INPUT의 별도 계산 결과를 baseline으로 유지해 모든 delta를 산출한다.
6. widget은 raw 숫자를 반올림하지 않고 format 함수로 표시만 반올림한다.
7. semantic Step components는 available 값, warning 또는 unavailable 상태를 렌더한다.
8. Current/Fair summary DOM과 SVG chart는 같은 comparison NodeResult를 사용한다.

### UI and Responsive Layout

- Root에 @container/dcf를 두고 host sidebar가 차지한 뒤의 실제 콘텐츠 폭으로 반응형을 결정한다.
- 기본/mobile은 Step 1~5 단일 열이다.
- 약 42rem container부터 2열 card layout을 사용한다.
- 약 64rem container부터 20rem assumptions column과 minmax(0,1fr) flow column을 사용한다.
- Y1~Y5는 넓은 container에서 semantic table, 그 아래에서 year article cards로 렌더한다.
- 동일 view를 중복 ID로 동시에 접근성 tree에 노출하지 않는다.
- range와 number input은 서로 다른 accessible name을 가지며 같은 help/error description을 공유한다.
- screen reader live update는 compact result summary 한 곳만 aria-live=polite로 둔다.
- Current/Fair chart는 figure, figcaption, svg role=img, title, desc와 외부 output metrics를 가진다.
- chart 핵심값은 tooltip이나 pixel assertion에 의존하지 않는다.

### Dependencies

- Runtime: Next.js 15, React 19, installed Base UI primitives, Tailwind CSS 4, lucide-react.
- Test: installed @playwright/test only.
- Native platform: input range, checkbox switch semantics, table, output, SVG.
- No new package, API, persistence, route navigation or root workspace change.

### Playwright Design

- calculation project: index-dcf-calculation.spec.ts만 한 번 실행하고 browser device를 사용하지 않는다.
- chromium project: 기존 desktop tests와 index-dcf-visualizer.spec.ts를 실행하되 calculation spec은 제외한다.
- mobile-chromium project: Pixel 5로 index-dcf-visualizer.spec.ts만 실행한다.
- webServer는 pnpm dev, http://127.0.0.1:2800, reuseExistingServer: !CI, timeout 120000으로 고정한다.
- reporter는 list와 open: never인 html을 사용한다.
- 접근 locator 우선순위는 role/name, label, visible output이고 test id는 semantic locator가 불가능할 때만 사용한다.
- 기존 chat/remotes E2E는 외부 LangGraph/BFF/remotes가 필요하므로 신규 focused suite와 별도로 결과를 보고한다.

### Implementation Order

1. constants와 types
2. validation과 calculation graph
3. Node-only calculation spec
4. route와 client widget state
5. assumptions controls
6. forecast, terminal, fair composition
7. accessible SVG comparison
8. responsive and accessibility polish
9. Playwright config와 browser spec
10. typecheck, lint, build, focused calculation/browser/mobile suite
11. design-to-code gap analysis and Gradate update

## Gap Analysis (Pre-Validate)

| Design Item | Implementation Evidence | Status |
| --- | --- | --- |
| Server route and metadata | `src/app/index-dcf-visualizer/page.tsx`가 metadata와 `IndexDcfVisualizer` mount를 제공하고 production build route table에서 정적 route로 확인됨 | Matched |
| Canonical widget/utils/constants modules | 신규 구현이 `src/widget/index-dcf`, `src/utils/index-dcf`, `src/constants/index-dcf.ts`로 분리됨 | Matched |
| Raw input and linked r_long state | `IndexDcfVisualizer.tsx`의 단일 raw state와 `syncLongRunDiscountRate`, `resolveLongRunDiscountRate` 전이가 calculation/browser spec으로 검증됨 | Matched |
| Structured validation and partial dependency graph | `validate-index-dcf.ts`, `node-result.ts`, `calculate-index-dcf.ts`가 structured issue와 available/unavailable graph를 구현함 | Matched |
| Demo fixture exact calculation | `index-dcf-calculation.spec.ts`가 demo Fair Index 5,577.33, +11.55%, 10.35% Discount to Fair를 포함한 16개 계산·오류·경고·연결 정책을 통과함 | Matched |
| Step 1 assumptions controls | `AssumptionsPanel.tsx`와 `AssumptionControl.tsx`가 22개 range/number pair, text/date, link toggle, reset을 제공함 | Matched |
| Step 2 forecast table/cards | `ForecastSection.tsx`가 container 폭에 따라 semantic Y1~Y5 table 또는 year cards를 제공함 | Matched |
| Step 3 terminal and warnings | `DiscountTerminalSection.tsx`와 `IssueSummary.tsx`가 discount/terminal chain, Error/Warning region, unavailable 상태를 제공함 | Matched |
| Step 4 fair composition | `FairValueComposition.tsx`가 PV 5yr, PV Terminal, Fair Index와 terminal share를 동일 계산 graph에서 표시함 | Matched |
| Step 5 accessible comparison chart | `ValuationComparisonChart.tsx`가 figure/figcaption, `svg role=img`, title/desc, DOM output과 bilingual status를 제공함 | Matched |
| Desktop/mobile Playwright coverage | 실제 Chromium/Pixel 5 focused suite 13 PASS, desktop의 mobile-only geometry 1건만 의도적 SKIP | Matched |
| Static/build checks and no dependency drift | `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check` PASS; dependency/lockfile 변경 없음. `pnpm audit --prod --audit-level high`는 기존 workspace 전이 의존성 48건(19 high)으로 FAIL하여 Validate 시 별도 기술부채로 추적 | Matched |

Current Match Rate: 100% (12/12 design items matched; missing 0, extra 0)

## Implementation Notes

- Design completed before code changes.
- Existing legacy src/features and src/components structure is not migrated.
- The selected apb-react-directory-policy influenced all newly created business, utility and constant paths.
- 실제 Chromium에서 role/name/label 기반 selector, default/overvalued 계산, 393px overflow와 accessibility tree를 먼저 확인한 뒤 최종 Playwright spec을 작성했다.
- Node-only calculation suite는 16/16 PASS, desktop/mobile browser suite는 13 PASS와 의도적 1 SKIP이다.
- `pnpm lint`, 단독 `pnpm typecheck`, production `pnpm build`, `git diff --check`가 통과했다. build와 동시에 실행한 최초 typecheck는 `.next/types` 재생성 경합으로 실패했으나 build 완료 후 단독 재실행에서 통과했다.
- 보안 감사 실패는 이번 기능이 dependency를 추가해서 생긴 회귀가 아니다. workspace-wide 기존 48건 중 이 앱 경로에는 `shadcn` 전이 `js-yaml`/`fast-uri`, Next 전이 `sharp` advisory가 포함된다.
