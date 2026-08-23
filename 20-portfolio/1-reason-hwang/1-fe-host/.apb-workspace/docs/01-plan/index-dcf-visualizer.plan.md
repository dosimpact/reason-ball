# index-dcf-visualizer Plan

## Decision Status

서브에이전트의 금융 모델, UX, 구현·검증 리뷰에서 발견한 모호성을 v1 범위에 맞게 해소했다.
이 문서의 입력 계약, 계산 규칙, 오류 정책, UI 구조와 검증 fixture를 Gradate 구현의 기준으로 사용한다.

## Goal

1-fe-host 안에 기존 화면과 분리된 Index DCF Visualizer 전용 App Router 화면을 만든다.
사용자가 DCF 가정값을 직접 슬라이드하면서 값의 변화가 5년 EPS, Cash Payout, 현재가치, 종료가치와 최종 적정 지수로 전달되는 과정을 하나의 단계형 Flow에서 이해할 수 있게 한다.
최종 적정 지수를 사용자가 입력한 현재 주가지수와 비교하여 DCF 기준 상승·하락 여력과 고평가·저평가 상태를 차트와 숫자로 보여준다.

## Scope

### In scope

- 프로젝트 범위는 /Users/studio/workspace/projects/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/로 제한한다.
- Next.js App Router 경로 /index-dcf-visualizer를 추가한다.
- 구현 진입점은 src/app/index-dcf-visualizer/page.tsx로 한다.
- 범용 광범위 주가지수용 교육·시뮬레이션 모델을 제공한다.
- Index EPS, 현재 지수와 모든 DCF 가정은 사용자가 직접 입력한다.
- 내장된 고정 Demo preset으로 초기 화면과 테스트 결과를 결정적으로 재현한다.
- 5년 Cash Payout 현재가치, 종료가치 현재가치, 적정 지수와 현재 지수 비교 차트를 제공한다.
- 직접 URL 접근만 지원하며 기존 사이드바나 기존 App Router 경로는 변경하지 않는다.

### Out of scope

- 1-fe-host 바깥의 앱, 패키지, 자산, 문서와 루트 pnpm-lock.yaml 변경
- 실시간 또는 원격 EPS·지수·금리·ERP 데이터 API
- 사용자 입력 저장, 계정 동기화, 서버 상태 또는 데이터베이스
- 특정 종목, 섹터지수, 레버리지 지수 또는 beta가 1이 아닌 지수의 조정 모델
- 투자 추천, 매수·매도 신호 또는 결과의 정확성을 보증하는 표현
- 새 Flow·차트·테스트 패키지 설치

## Model Context and Data Contract

### 대상 모델

- v1은 beta = 1인 광범위 시장지수를 가정한다.
- Risk-free Rate, Implied ERP, EPS, 성장률과 Current Index는 같은 통화·명목 기준을 사용한다.
- Actual Index EPS는 대상 지수 제공자가 같은 index divisor로 산출한 TTM index earnings points여야 한다.
- Current Index와 Actual Index EPS는 같은 지수, 같은 제공자·divisor 기준이어야 한다.
- 서로 다른 지수의 EPS, 구성종목 EPS 단순 합계 또는 개별 기업 EPS를 Current Index와 비교하지 않는다.
- 현금흐름과 적정 지수의 표시 단위는 index points로 통일한다.

### 기준 시점

- 모든 입력은 하나의 Valuation As-of Date를 공유한다.
- Actual Index EPS는 As-of Date에 이용 가능한 최근 TTM 값이다.
- Current Index는 As-of Date의 종가다.
- Risk-free Rate와 Implied ERP는 같은 As-of Date의 관측값이다.
- 화면 상단에 Index Name, Valuation As-of Date, EPS Basis: TTM, Unit: Index points를 항상 표시한다.

### 데이터 정책

- v1은 외부 데이터를 가져오지 않는다.
- Index Name과 Valuation As-of Date는 메타데이터 입력이고, 숫자 가정은 수동 입력한다.
- Demo preset은 합성 예시이며 실제 시장 데이터나 투자 의견이 아니라는 문구를 표시한다.
- 사용자는 Actual Index EPS와 Current Index가 같은 지수·divisor·기준일을 사용한다는 안내를 확인할 수 있어야 한다.

### EPS 성장률과 바이백 정의

- EPS 성장률은 모델에 입력한 향후 Net Buyback P/O가 만들어낼 추가적인 주당 accretion을 제외한 기초 earnings 성장률로 정의한다.
- Net Buyback P/O는 순이익 대비 주식 재매입 현금유출에서 주식 발행 효과를 차감한 순주식환원 비율이다.
- 이 정의로 미래 바이백을 EPS 성장과 Cash Payout에 동시에 중복 반영하지 않는다.
- Dividend P/O는 순이익 대비 현금배당 비율이다.

## Input Contract and Demo Preset

모든 숫자 입력은 슬라이더와 직접 숫자 입력을 한 쌍으로 제공한다. 숫자 입력이 비어 있거나 범위를 벗어나면 raw input state에는 유지하되 값을 자동 보정하지 않고 inline error를 표시한다. 검증된 assumptions에는 포함하지 않으며 영향을 받는 하위 계산은 유효한 값이 되기 전까지 Calculation unavailable로 표시한다.

| Input | Demo default | Min | Max | Step | Unit / policy |
|---|---:|---:|---:|---:|---|
| Index Name | Demo Broad Market Index | - | - | - | 최대 80자 text |
| Valuation As-of Date | 2026-01-01 | - | - | 1 day | ISO date, Demo 고정값 |
| Actual Index EPS | 350 | 1 | 10,000 | 1 | index points, TTM |
| Current Index | 5,000 | 1 | 100,000 | 1 | index points, same-date close |
| EPS Growth Y1~Y5 | 각 6.0 | -20.0 | 20.0 | 0.1 | %, future buyback accretion 제외 |
| Dividend P/O Y1~Y5 | 각 40 | 0 | 100 | 1 | % |
| Net Buyback P/O Y1~Y5 | 각 30 | -50 | 100 | 1 | %, 음수는 net issuance |
| Risk-free Rate | 4.00 | 0.00 | 10.00 | 0.05 | %, nominal |
| Implied ERP | 4.50 | 0.00 | 10.00 | 0.05 | %, broad-market beta = 1 |
| Perpetual Growth g | 2.50 | 0.00 | 5.00 | 0.05 | %, nominal |
| Long-run Normalized ROE | 15.00 | 5.00 | 40.00 | 0.25 | % |
| Use Forecast Discount Rate | on | - | - | toggle | on이면 r_long = r |
| Independent r_long | 8.50 | 1.00 | 20.00 | 0.05 | %, toggle off에서만 활성 |

### r_long 연동 규칙

- Use Forecast Discount Rate가 on이면 r_long은 r과 실시간 동기화되고 독립 입력은 read-only다.
- off로 바꾸면 마지막 동기화 값을 독립 r_long의 시작값으로 유지한다.
- off 상태에서 r이 바뀌어도 독립 r_long은 바뀌지 않는다.
- 다시 on으로 바꾸면 독립값을 사용하지 않고 즉시 r과 동기화한다.

### Reset과 변화 기준

- Reset Demo 버튼은 메타데이터와 모든 숫자 입력을 Demo default로 되돌린다.
- 모든 증가·감소 delta는 직전 렌더나 드래그 시작값이 아니라 Demo default 계산 결과를 기준으로 한다.
- Reset 직후 모든 delta는 0으로 표시한다.
- v1은 사용자 지정 baseline 저장이나 undo history를 제공하지 않는다.

## Flow UX

### 정보 구조

화면은 다음 다섯 단계를 한 방향으로 연결한다.

1. Context & Assumptions: 지수 메타데이터와 사용자 입력
2. Five-year Forecast: Y1~Y5 EPS, Total P/O와 Cash Payout
3. Discount & Terminal: 예측기간 PV, Y6 정상화와 Terminal Value
4. Fair Index Composition: PV 5yr + PV Terminal
5. Market Comparison: Current Index, Fair Index, valuation status

### 화면 배치

- Desktop 1024px 이상: 왼쪽에 320px Assumptions 패널, 오른쪽에 단계형 계산 Flow를 둔다. Y1~Y5는 열이 Y1~Y5인 semantic table로 표시한다.
- Tablet 768~1023px: 입력과 결과를 2열로 나누고 Y1~Y5는 2~3열 카드로 줄바꿈한다.
- Mobile 767px 이하: 입력, Y1~Y5 연도 카드, 종료가치와 결과를 단일 열 세로 순서로 배치한다. 가로 스크롤, pan과 zoom에 의존하지 않는다.
- 계산 Flow는 자유 이동 node canvas가 아니라 semantic HTML 카드와 inline SVG 연결선으로 구현한다. Mobile에서는 연결선을 숨긴다.
- 모바일에서 연결선보다 단계 제목, 입력값, 공식 결과와 오류 메시지를 우선한다.

### 인터랙션

- 각 슬라이더는 visible label, 현재값, 단위와 연결된 숫자 입력을 가진다.
- Slider와 숫자 입력은 키보드로 조작할 수 있고 포커스 표시를 유지한다.
- 유효한 값은 debounce 없이 같은 React render cycle에서 모든 하위 결과를 재계산한다.
- 별도 derived state를 저장하지 않고 단일 raw input state를 검증·정규화한 assumptions에서 순수 계산 결과를 파생한다.
- 차트 애니메이션은 사용하지 않으며 prefers-reduced-motion을 존중한다.
- 변경값과 Demo baseline 대비 delta는 DOM text로 표시한다.
- 오류는 원인이 된 입력 가까이에 표시하고 aria-describedby로 연결한다.
- 오류에 영향받는 하위 노드만 Calculation unavailable로 전환하며 이전 정상값을 현재 결과처럼 남기지 않는다.

### 계산 Flow Diagram

~~~mermaid
flowchart LR
    context[Index name / As-of / Actual EPS / Current Index] --> eps[EPS Y1~Y5]
    growth[Growth Y1~Y5] --> eps
    dividend[Dividend P/O Y1~Y5] --> total[Total P/O Y1~Y5]
    buyback[Net Buyback P/O Y1~Y5] --> total
    eps --> cash[Cash Payout Y1~Y5]
    total --> cash

    riskFree[Risk-free Rate] --> discount[Forecast discount r]
    erp[Implied ERP] --> discount
    cash --> forecastPv[PV 5yr]
    discount --> forecastPv

    eps --> eps6[EPS Y6]
    perpetual[Perpetual g] --> eps6
    perpetual --> longPayout[Long-run Payout]
    normalizedRoe[Normalized ROE] --> longPayout
    eps6 --> cash6[Cash Payout Y6]
    longPayout --> cash6
    cash6 --> terminal[TV at Y5]
    perpetual --> terminal
    longDiscount[r_long] --> terminal
    terminal --> terminalPv[PV Terminal]
    discount --> terminalPv

    forecastPv --> fair[Fair Index]
    terminalPv --> fair
    fair --> chart[Current vs Fair chart]
    context --> chart
    chart --> status[Upside / Downside and Premium / Discount]
~~~

## Index DCF Calculation Rules

### 1. EPS forecast

$$
EPS_t = EPS_{t-1} \times (1 + growth_t), \quad t=1,\ldots,5
$$

growth_t는 decimal로 계산하며 미래 Net Buyback P/O에 따른 추가 accretion을 제외한다.

### 2. Cash Payout

$$
Total\ P/O_t = Dividend\ P/O_t + Net\ Buyback\ P/O_t
$$

$$
Cash\ Payout_t = EPS_t \times Total\ P/O_t
$$

Net Buyback P/O가 음수이면 net issuance로 인해 Cash Payout을 감소시킨다. Total P/O가 0% 미만 또는 100% 초과여도 경제적으로 가능한 특수 상태이므로 계산은 유지하되 경고한다.

### 3. Forecast discount rate

$$
r = Risk\text{-}free\ Rate + Implied\ ERP
$$

v1은 광범위 시장지수의 beta = 1을 가정하며 별도의 beta 또는 country risk premium을 추가하지 않는다.

### 4. Five-year present value

현금흐름은 각 연도 말에 지급되고 t = 1은 Valuation As-of Date로부터 정확히 1년 뒤라는 end-of-year convention을 사용한다.

$$
PV_t = \frac{Cash\ Payout_t}{(1+r)^t}
$$

$$
PV_{5yr} = \sum_{t=1}^{5} PV_t
$$

### 5. Terminal value

v1은 Y5 다음 해부터 즉시 장기 정상 상태로 전환한다. 별도의 fade period는 사용하지 않는다. UI는 Y5와 Y6 성장률·Payout 차이 및 Terminal Value 비중을 나란히 보여 이 가정을 숨기지 않는다.

$$
EPS_6 = EPS_5 \times (1+g)
$$

$$
Retention = \frac{g}{ROE_{normalized}}
$$

$$
Long\text{-}run\ Payout = 1 - \frac{g}{ROE_{normalized}}
$$

$$
Cash\ Payout_6 = EPS_6 \times Long\text{-}run\ Payout
$$

$$
TV_5 = \frac{Cash\ Payout_6}{r_{long}-g}
$$

### 6. Present value of terminal value

$$
PV(TV) = \frac{TV_5}{(1+r)^5}
$$

r_long은 Y5 이후 위험에 사용하고, r은 Y5 시점의 Terminal Value를 현재로 할인하는 데 사용한다.

### 7. Fair Index

$$
Fair\ Index = PV_{5yr} + PV(TV)
$$

### 8. Market comparison metrics

절대 gap:

$$
Valuation\ Gap = Fair\ Index - Current\ Index
$$

현재 지수에서 적정 지수까지의 주 지표:

$$
Upside/Downside\ (\%) =
\left(\frac{Fair\ Index}{Current\ Index} - 1\right) \times 100
$$

적정 지수 대비 현재 시장의 premium 또는 discount를 설명하는 보조 지표:

$$
Premium/Discount\ to\ Fair\ (\%) =
\left(\frac{Current\ Index}{Fair\ Index} - 1\right) \times 100
$$

- Upside/Downside가 +0.005 percentage point 이상이면 저평가 상태와 양수 Upside를 표시한다. 보조 지표가 음수이면 절댓값을 Discount to Fair로 표시한다.
- Upside/Downside가 -0.005 percentage point 이하이면 고평가 상태와 음수 Downside를 표시한다. 보조 지표가 양수이면 Premium to Fair로 표시한다.
- Upside/Downside의 절댓값이 0.005 percentage point 미만이면 적정가 상태로 표시한다.
- 고평가·저평가라는 단어만 쓰지 않고 기준 분모가 다른 두 지표의 이름과 공식을 도움말로 제공한다.

## Validation Policy

### Error와 Warning

| Condition | Level | Behavior |
|---|---|---|
| NaN, Infinity 또는 숫자 변환 실패 | Error | 해당 입력과 모든 하위 결과를 Calculation unavailable로 표시 |
| Actual Index EPS <= 0 | Error | EPS forecast 이후 계산 중단 |
| Current Index <= 0 | Error | Market Comparison만 중단 |
| growth_t <= -100% | Error | 해당 연도 이후 forecast 중단 |
| ROE_normalized <= 0 또는 g >= ROE_normalized | Error | Long-run Payout 이후 계산 중단 |
| r_long <= g | Error | Terminal Value 이후 계산 중단 |
| Fair Index <= 0 | Error | Market Comparison과 고평가·저평가 판정 중단 |
| 입력이 설정된 min/max 밖 | Error | raw input은 보존하되 assumptions로 정규화하지 않고 하위 계산 중단 |
| Total P/O_t < 0% 또는 > 100% | Warning | 계산 유지, 해당 연도에 특수 환원정책 경고 |
| 0 < r_long - g < 1.00 percentage point | Warning | 계산 유지, Terminal Value 고감도 경고 |
| PV(TV) / Fair Index > 80% | Warning | 계산 유지, 적정 지수의 종료가치 의존 경고 |

- Error 발생 시 직전 정상값을 현재 결과처럼 유지하지 않는다.
- Warning은 결과를 유지하되 원인 노드, 결과 요약과 접근 가능한 warning list에 표시한다.
- 임의 clamp로 유효한 값처럼 보이게 하지 않는다.

### Precision and display

- 모든 percentage 입력은 계산 직전에 100으로 나누어 decimal로 변환한다.
- 내부 계산은 JavaScript number 원값으로 유지하며 중간 반올림을 하지 않는다.
- 테스트 비교 허용 오차는 max(1e-9, abs(expected) × 1e-9)로 한다.
- index points, EPS, Cash Payout, PV는 화면에서 소수점 2자리로 표시한다.
- percentage와 ratio는 화면에서 소수점 2자리로 표시한다.
- 상태 판정은 반올림 전 Upside/Downside 값으로 수행한다.

## Valuation Comparison Chart

- 추가 패키지 없이 semantic HTML, CSS와 SVG로 구현한다.
- Current Index와 Fair Index 두 막대를 같은 linear scale과 0 baseline에서 비교한다.
- Fair Index 막대는 비교용 전체값 하나로 표현하고, PV 5yr와 PV Terminal 구성은 별도의 항상 보이는 composition card로 표시한다.
- Current Index, Fair Index, absolute gap, Upside/Downside, Premium/Discount to Fair와 상태는 차트 밖 DOM text로 항상 표시한다.
- SVG에는 text summary와 같은 값을 설명하는 accessible name 또는 description을 제공한다.
- 색상 외에 라벨, 부호, 패턴 또는 테두리로 Current, Fair, 고평가와 저평가를 구분한다.
- Tooltip은 보조 정보일 뿐 핵심 수치의 유일한 표시 수단으로 사용하지 않는다.
- Fair Index가 0 이하이거나 계산 Error가 있으면 정상 비교 차트를 숨기고 Calculation unavailable와 원인을 표시한다.
- 차트는 입력마다 즉시 다시 그리되 motion animation을 사용하지 않는다.

## Implementation Boundaries

### Planned modules

- src/app/index-dcf-visualizer/page.tsx: Server Component route shell과 metadata
- src/widget/index-dcf/IndexDcfVisualizer.tsx: use client가 있는 business-aware interactive widget
- src/widget/index-dcf/: assumption, forecast, terminal, summary와 chart components
- src/utils/index-dcf/types.ts: DcfInputState, DcfAssumptions, DcfResult, validation types
- src/constants/index-dcf.ts: 고정 Demo preset과 input constraints
- src/utils/index-dcf/calculate-index-dcf.ts: React와 분리된 순수 계산 함수
- src/utils/index-dcf/validate-index-dcf.ts: raw input을 검증된 assumptions로 정규화하는 Error·Warning 정책
- tests/e2e/index-dcf-calculation.spec.ts: 기존 Playwright runner를 사용하는 Node-only calculation spec
- tests/e2e/index-dcf-visualizer.spec.ts: browser interaction과 접근성 이름 검증

### State and performance

- page.tsx는 Server Component로 유지하고 IndexDcfVisualizer만 Client Component로 만든다.
- DcfInputState만 mutable source of truth로 저장한다.
- validateIndexDcf(inputState)는 검증된 DcfAssumptions와 Error·Warning을 반환한다.
- DcfResult는 calculateIndexDcf(validAssumptions)의 순수 반환값이며 useMemo로 파생한다.
- 계산 결과를 별도 React state에 복제하지 않는다.
- slider onValueChange마다 debounce 없이 재계산한다.
- Demo 최대 입력 수에서 입력부터 DOM 결과 갱신까지 100ms 이내를 목표로 한다.

### Dependencies

- 설치된 React, Next.js, Base UI, Tailwind와 브라우저 SVG 기능만 사용한다.
- Flow canvas나 chart library를 새로 설치하지 않는다.
- 계산 spec과 E2E에는 이미 설치된 @playwright/test만 사용한다.
- Gradate 구현은 1-fe-host 밖 파일과 루트 pnpm-lock.yaml을 변경하지 않는다.

## Deterministic Demo Fixture

Demo preset의 계산 결과는 다음을 기준으로 한다.

| Derived value | Expected raw value |
|---|---:|
| r | 0.085 |
| EPS Y1 | 371 |
| EPS Y2 | 393.26000000000005 |
| EPS Y3 | 416.8556000000001 |
| EPS Y4 | 441.8669360000001 |
| EPS Y5 | 468.37895216000015 |
| PV 5yr | 1142.8794941603244 |
| EPS Y6 | 480.0884259640001 |
| Long-run Payout | 0.8333333333333333 |
| Cash Payout Y6 | 400.0736883033334 |
| TV at Y5 | 6667.894805055558 |
| PV Terminal | 4434.452923070939 |
| Fair Index | 5577.332417231263 |
| Upside/Downside | 11.546648344625265% |
| Premium/Discount to Fair | -10.351407698913284% |
| Terminal Value share | 79.50849243574977% |

초기 화면은 Current Index 5,000.00, Fair Index 5,577.33, +11.55% Upside, 10.35% Discount to Fair와 저평가 상태를 표시해야 한다.

## Verification

- Implementation scope: 1-fe-host 내부 신규 route, feature modules, 순수 계산, Flow UI와 비교 차트
- Public interface: GET /index-dcf-visualizer browser page. API와 persistence 없음.
- External dependencies: 없음.
- Internal dependencies: Next.js App Router, React, Base UI, Tailwind, @playwright/test
- Risky areas: unit compatibility, buyback 중복 반영, terminal sensitivity, warning propagation, float precision, mobile density와 slider update performance

### Static and build checks

- package.json에 typecheck script를 추가하고 pnpm --filter reason-hwang-fe-host typecheck를 통과한다.
- pnpm --filter reason-hwang-fe-host lint를 통과한다.
- pnpm --filter reason-hwang-fe-host build를 통과한다.
- 새 dependency와 root lockfile 변경이 없어야 한다.

### Calculation tests

- Demo fixture의 모든 expected raw value를 지정 허용 오차로 검증한다.
- Y1 성장률 변경이 Y1~Y5, Y6, PV와 Fair Index에 연쇄 반영되는지 검증한다.
- Dividend와 Net Buyback P/O가 Total P/O와 Cash Payout에 정확히 합산되는지 검증한다.
- linked·independent r_long 전환 규칙을 검증한다.
- Error·Warning 표의 각 조건을 적어도 하나의 테스트로 검증한다.
- 표시용 반올림이 raw calculation을 변경하지 않는지 검증한다.

### Browser and responsive tests

- playwright.config.ts에 command: pnpm dev, url: http://127.0.0.1:2800, reuseExistingServer: !CI, timeout: 120000인 webServer를 설정한다.
- Desktop Chrome과 Pixel 5 viewport 두 project를 같은 config에 둔다.
- slider는 accessible name으로 찾고, 연결된 숫자 입력과 결과 DOM text를 검증한다.
- Current/Fair 차트의 핵심 결과는 Tooltip이나 SVG pixel이 아니라 DOM text로 검증한다.
- mobile에서 가로 page overflow가 없고 단계 순서가 유지되는지 검증한다.
- 기존 App Router smoke test가 계속 통과해야 한다.

## E2E Scenarios

1. Given Demo preset, When page loads, Then Demo fixture의 Fair Index 5,577.33, +11.55% Upside, 10.35% Discount to Fair와 저평가 상태가 보인다.
2. Given Demo preset, When EPS Growth Y1을 변경하면, Then Y1~Y6 EPS, Cash Payout, PV, Fair Index와 비교 차트가 같은 interaction에서 갱신된다.
3. Given Demo preset, When Dividend P/O 또는 Net Buyback P/O를 변경하면, Then 해당 연도 Total P/O부터 Fair Index까지 갱신된다.
4. Given linked r_long, When Risk-free Rate 또는 ERP를 변경하면, Then r과 r_long이 함께 갱신되고 모든 PV가 다시 계산된다.
5. Given independent r_long, When r을 변경하면, Then r_long은 유지되고 forecast PV와 terminal discount 결과만 각 정의에 따라 갱신된다.
6. Given Total P/O가 100%를 초과하면, When 계산되면, Then 결과는 유지되고 해당 연도와 summary에 Warning이 표시된다.
7. Given r_long <= g 또는 g >= normalized ROE, When 계산되면, Then Terminal 이후는 Calculation unavailable이고 NaN 또는 Infinity가 표시되지 않는다.
8. Given Current Index <= 0, When 숫자 입력에 해당 값을 입력하면, Then inline Error가 표시되고 Market Comparison은 정상 차트를 표시하지 않는다.
9. Given Fair Index > Current Index, When comparison renders, Then 저평가, 양수 Upside와 Discount to Fair가 정확한 분모와 함께 표시된다.
10. Given Fair Index < Current Index, When comparison renders, Then 고평가, 음수 Downside와 Premium to Fair가 정확한 분모와 함께 표시된다.
11. Given mobile viewport, When 모든 Flow 단계를 탐색하면, Then 단일 열 순서, keyboard controls와 no horizontal page overflow가 유지된다.
12. Given any Error, When upstream input is corrected, Then stale result 없이 해당 하위 Flow와 chart가 즉시 정상 결과로 복구된다.

## Deferred Future Enhancements

- 실제 지수 데이터 API와 기준일 자동 동기화
- 특정 지수 preset과 출처 표시
- beta, country risk premium과 sector-specific model
- mid-year convention 또는 stub period
- Y5에서 장기 정상 상태로 이어지는 fade period
- 사용자 scenario 저장, 공유와 여러 scenario 비교
- 별도 sensitivity heatmap

## Skills

### Gradate 단계

- apb-react-directory-policy

### Validate 단계

- apb-playwright-e2e
- apb-static-analysis
- apb-gap-analysis

### Recommendation Review

- KEEP apb-react-directory-policy: Next.js App Router는 framework 예외로 유지하고 신규 business-aware UI는 widget, 순수 계산은 utils, preset은 constants로 분리하는 데 적합하다. 기존 legacy components/features/lib/shared는 범위 밖이라 이동하지 않는다.
- KEEP apb-playwright-e2e: 사용자 요청의 실시간 slider, 오류 복구, 비교 차트와 mobile flow를 실제 브라우저에서 검증한다.
- KEEP apb-static-analysis: 구현 후 lint, typecheck와 보안 관련 정적 검사를 한 번에 점검할 수 있다.
- KEEP apb-gap-analysis: Gradate 설계 항목과 실제 코드·테스트의 누락을 정량적으로 점검한다.
- DROP apb-unit-test-write: Jest/Vitest 추가를 전제로 하므로 새 dependency와 root lockfile 변경 금지 결정에 맞지 않는다. 순수 계산은 기존 Playwright runner의 Node-only spec으로 검증한다.
- DROP apb-code-coverage: 현재 프로젝트에 unit coverage 도구가 없고 v1은 새 dependency를 금지한다.
- DROP apb-validation-report: 현재 요청은 Gradate 구현과 E2E까지이며 최종 Validate phase 전환은 별도다.
- DROP apb-bruno-api-tests: v1에는 API surface가 없다.
