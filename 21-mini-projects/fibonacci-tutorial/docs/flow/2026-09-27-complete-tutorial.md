# 전체 튜토리얼 구현

날짜: 2026-09-27. 상태: 전체 MVP 구현·검증 완료.

## 범위 FT-01

사용자가 master-plan 전체 기능 완성을 요청했습니다. 상승 Impulse에 한정하여 Lesson 1–6을 이론·연습 유닛으로 구현합니다. ABC/Diagonal/자동 탐지/실제 주문/인증·다중 서버 배포는 원래 범위 밖입니다. 기존 Walking Skeleton의 저장·Replay를 유지하며 확장합니다.

## 공유 구현 계약

기존 API/SessionView/TradePlan 필드는 하위 호환으로 유지하고 새 필드는 default 또는 optional로 추가합니다. 기존 JSON도 읽을 수 있어야 합니다. `entities/tutorial/index.ts`에서 아래 계약을 공개합니다. 서버와 UI는 이 계약만 사용합니다.

### 콘텐츠

3개 챕터, 9개 유닛:
- 기초: `impulse-theory`(이론), `wave-counting`(count), `rules-theory`(이론), `rules-practice`(count).
- 계획: `wave-three`(trade; 기존 ID/fixture 유지), `fibonacci-theory`(이론), `fibonacci-practice`(fibonacci).
- 평가: `trade-review`(trade), `market-lab`(trade; dummy/binance 선택).

UnitSummary 기존 필드 외 `chapterId`, `objectives:string[]`, `task:'theory'|'count'|'fibonacci'|'trade'`, `selectionCount:3|6`, `allowedSources:('dummy'|'binance')[]`, `completionCriteria:string`. 전체 유닛/시나리오는 서버 전용 콘텐츠 모듈에서만 로드합니다. 카탈로그는 summary만 반환하며 이론 다음 단계·예시 답·미래 캔들은 번들에도 포함하지 않습니다.

TheoryStep: `{title,description,visibleCount,waveIndices:number[],showFibonacci:boolean}`. 이론 단계에서 표시할 파동은 현재 공개 데이터 범위 내입니다. 예시 답은 요청 전 SessionView에 넣지 않습니다.

### 세션과 API

기존 SessionView에 `unit:UnitSummary`, `source:SourceConfig`, `theoryStep:number`, `theoryStepCount:number`, `instruction:{title,description,showFibonacci:boolean}`, `selectedIndices:number[]`, `validation:ValidationResult[]`, `hint:string|null`, `exampleIndices:number[]|null`, `plans:TradePlan[]` 추가 (기존 plan은 현재 active plan).

SourceConfig = `{type:'dummy'}` 또는 `{type:'binance',symbol:'BTCUSDT'|'ETHUSDT',interval:'1h'|'4h'|'1d',startTime?:number}`. startTime은 UTC milliseconds, 없으면 최근 확정봉 구간. 서버가 limit/범위 고정. source 선택은 세션 생성 때만.

- POST /api/sessions `{unitId,source?:SourceConfig}`. default dummy. initial wave-three 8/12 유지.
- POST /api/sessions/:id/advance `{expectedStep:number}`: 이론 다음 단계/마지막 완료. 마지막 단계에서 버튼 눌러 complete.
- POST /api/sessions/:id/check `{waveIndices:number[]}`: 6점 count/fibonacci 검증 또는 3점 Fibonacci. validation 저장, pass이면 해당 비매매 연습 complete.
- POST /api/sessions/:id/hint `{kind:'hint'|'example'}`: 힌트/공개 범위 내 예시만 제공. 검증 시도 후 example 허용. 매매 미래 답은 Replay 종료 전 제공하지 않음.
- POST /api/sessions/:id/plan 기존 + `decisionReasons?:{wave,fibonacci,entry,stopLoss,target,invalidation,exit:string}` + `exitStrategy?:string`. 3점 trade. rationale 기존 호환. API가 수치·판정·무효화 기준 생성.
- POST /api/sessions/:id/revise `{expectedPlanId:string}`: 현재 공개 시점을 기준으로 새 초안 작성 시작. 이전 plans 보존, plan=null, 새 confirm은 revision+1, previousPlanId. 새 평가에는 해당 active plan.asOf 이후만 사용. 기대 ID 충돌409. 미래를 본 뒤 옛 asOf로 새 계획을 만들 수 없음.
- POST /api/sessions/:id/replay 기존; 계획 필요 trade, complete 후409. auto Play/Pause는 UI에서 await 후 일정 간격 요청, 오류/이동/완료 시 중지.
- POST /api/sessions/:id/evaluate `{}`: Binance 계획의 asOf 이후 확정봉을 조회, 같은 순수 평가기로 `later-market` 평가를 append. pending/no new bars 명시. 데이터 버전/관측 범위 포함. 새 데이터는 공개 candle에도 일관되게 반영. 미래 선후를 강제로 결정하지 않음.
- GET /api/sessions/:id/export: JSON `{schemaVersion,session,schemas:{tradePlan,tradeEvaluation}}` 공개 데이터만 export. 이전 계획·평가 포함. 계획 JSON Schema는 `z.toJSONSchema`.

ValidationResult `{rule:string,pass:boolean,reason:string}`.

### 도메인 계약 (entities 담당)

- 기존 `selectWavePoints` 3점 호환. `selectImpulsePoints(candles,indices)` 6점, wave0–5 low/high 번갈아. `validateImpulse(points)` 3대 규칙별 결과. 상승 구조·순서·6개 입력도 별도 검증. 경계 equality 정책 테스트.
- `fibonacciLevels(points)` → `{retracement382,retracement50,retracement618,extension1618}`. 기존 calculateFibonacci 유지.
- TradePlan 기존 필드 유지하며 schemaVersion 기존1 호환, `revision`, `previousPlanId`, `scenarioId`, `sourceConfig`, `invalidationPrice`, `decisions`, `exitStrategy`, `validation` 추가. defaults로 기존 저장자료 읽기.
- TradeEvaluation 기존 + `schemaVersion`, `evaluationMode`, `observedFrom`, `snapshotId`, `returnPercent`, `riskRewardRatio`, `feedback:ValidationResult[]` (optional/default로 기존 호환). 수수료/슬리피지0 touch-v1 유지. 무효화=카운팅 기준, stopLoss=사용자 청산가격으로 구분.

### 데이터·검증

Binance 공개 market-data 전용 base https://data-api.binance.vision, timeout/429/에러 명시. 확정봉만 normalize; 공통 Candle optional volume. 원본 형식/정렬/중복/OHLC 범위 검증. 캐시: 요청 키별 과거 고정구간24h, 최근30s, 오류 미캐시, 진행봉 제외. 세션별 전체 스냅샷 고정. 테스트는 소유한 로컬 Binance stub을 환경변수 base URL로 주입하며 실제 API smoke도 별도 수행해 mock/live 결과 구분.

Given/When/Then: 이론 Next는 설명·공개 봉·오버레이 함께 변경; 유닛 이동 후 상태 혼합 없음; 6점 count 규칙별 실패/수정/pass; 예시 답 사전 비노출; Fibonacci 가격/연결선 zoom/pan 동기화; Replay Play/Pause 종료; revision 이전 계획 불변/asOf 새 시점; later-market API 캐시/확정봉/실패/재평가; JSON export 스키마; 새로고침/재시작 복원.

검증 스킬: apb-bruno-api-tests 및 apb-playwright-e2e. 최종 stock·튜토리얼 유닛 명세·검증 결과 동기화 예정.

추가 결정: 관찰 후 청산 판단은 `POST /api/sessions/:id/reflection {decision:'close'|'hold',reason}`으로 별도 보존합니다. `SessionView.reflection`은 `{decision,reason,createdAt}` 또는 null입니다. Replay 완료/사후 관찰 뒤에만 허용하며 이전 모의 체결 결과를 소급 변경하지 않습니다.

참조: [Binance 공개 market-data 전용 endpoint](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md), [Klines 계약](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#klinecandlestick-data), [Lightweight Charts price line](https://tradingview.github.io/lightweight-charts/tutorials/how_to/price-line). 실제 public endpoint 연결은 HTTP200을 확인했습니다. 최종 앱 경유 검증은 통합 뒤 수행합니다.


## 최종 결과와 동기화

3챕터/9유닛, 이론·연습, 6점 규칙 검증, Fibonacci 가격선, immutable plan/revision/export, 자동 Replay, Binance 캐시·사후 평가, 5파 관찰과 청산 회고를 구현했습니다. trade-review는 8/20 초기 공개와 완료 후 6점 예시를 사용합니다. 향후 유닛은 독립 콘텐츠 디렉터리와 카탈로그에 추가합니다.

검증: 단위 29, Bruno 48, UI E2E 9, Storybook 10 PASS. production/Storybook build, lint/FSD, typecheck, 재시작/동시 Replay PASS. 실제 Binance 앱 경유 생성201·확정200·평가200·재평가200, 원래 계획 보존 확인. 자세한 결과와 제약은 [검증 보고서](../validation/full-tutorial.md)를 참조합니다.

통합에서 SSR와 localStorage 진행률의 hydration 차이, 이전 계획 평가 표시, 자동 Replay 종료 경계, 20봉 시나리오의 테스트 가정을 수정하고 전체를 재실행했습니다. 정규화·불변 스냅샷·이전 JSON migration·새 관측 없음·상류 오류는 회귀 테스트에 포함했습니다. 사후 조회는 4,000봉으로 제한해 장기 범위의 불완전한 평가를 방지합니다.

현재 비즈니스·시스템 stock, README, 유닛 시나리오와 문서 지도를 동기화했습니다. 사용자 원본 master-plan 및 도메인 초안은 보존했습니다. 임시 테스트 서버·데이터를 정리하고 MCP 페이지를 닫았습니다. 커밋·배포는 수행하지 않았습니다.
