# 시스템·개발 설계

상태: 2026-09-27 기준 실행 코드의 현재 계약입니다. [비즈니스 설계](business-design.md)를 구현하며 검증 요구 ID FT-01–14는 [전체 튜토리얼 검증](../validation/full-tutorial.md)에 둡니다. 설치 버전과 명령은 `package.json`·루트 lockfile이 기준입니다.

## 구성과 상태 경계

Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Radix 기반 공통 UI, TanStack Query 5, Zustand 5, Lightweight Charts 5, Zod 4를 사용합니다. `src/app`은 얇은 페이지·HTTP 라우트·Provider, `src/views/tutorial`은 조회·mutation과 화면 조합, `widgets`는 사이드바·차트·평가 표시, `features`는 파동 초안·계획 입력, `entities`는 스키마와 순수 계산, `src/server`는 외부 데이터·세션 I/O입니다. FSD pages 역할은 Next.js 라우트와 충돌을 피하기 위해 `views`라고 부릅니다. 슬라이스 공개 `index.ts`와 필요한 `@x` 경계를 사용하며 `scripts/check-boundaries.mjs`가 lint에서 import 경계를 검사합니다.

서버가 공개 cursor·스냅샷·계획·평가의 원본입니다. Query는 조회된 서버 상태, Zustand는 확정 전 파동 선택, React 로컬 상태는 화면 입력·Play/Pause 등을 관리합니다. 브라우저는 세션 ID를 URL·localStorage에 기억합니다. 완료 목록은 브라우저에도 기록되지만 세션 완료 여부는 서버가 결정합니다. 유닛별 콘텐츠는 `src/entities/tutorial/content/units/`에 분리하고 `server.ts`에 등록합니다. 카탈로그는 10개 챕터·44개 유닛이며 `theory`·`practice`, `theory`·`count`·`fibonacci`·`trade`·`analysis` 과제를 구분합니다.

## 디렉터리 구조

```text
src/
├── app/                       # Next 라우트, API 진입, Provider
├── views/                     # tutorial 유닛 화면, curriculum 메인·챕터
├── widgets/                   # tutorial-sidebar, chart-workspace, evaluation-panel
├── features/                  # count-waves, confirm-trade-plan
├── entities/
│   ├── tutorial/content/units/ # 유닛별 콘텐츠·시나리오 (서버 전용)
│   ├── lesson/content/units/   # 신규35유닛·비공개 문항 정답/사례
│   ├── candle/
│   ├── wave/                  # 선택·독립 규칙 validator
│   ├── fibonacci/             # 순수 가격 계산
│   ├── trade-plan/            # 불변 계획·스키마
│   └── trade-evaluation/      # 순수 체결·성과·피드백
├── shared/                    # ui, lib, api
└── server/                    # candle-data, sessions I/O

docs/                          # stock, flow, tutorials, validation
e2e/                           # bruno-api-tests, playwright
scripts/                       # 경계 검사·소유 서버 검증 runner
```

새 유닛은 `entities/tutorial/content/units/<unit-id>/`에 콘텐츠를 두고 공개 요약 카탈로그와 서버 registry에 등록합니다. 같은 과제 유형이면 차트·규칙·평가를 재사용합니다. 새로운 과제 유형은 실행 스키마와 서버 동작·화면을 함께 확장하고 관련 검증을 추가합니다. 저수준 판정은 entities의 순수 함수에, 외부 요청·저장 부작용은 server 경계에 둡니다.

## HTTP 계약

| HTTP | 입력 | 역할 |
| --- | --- | --- |
| GET `/api/catalog` | 없음 | 챕터·유닛 목록 |
| POST `/api/sessions` | `{unitId, source?}` | 유닛·소스별 새 세션 |
| GET `/api/sessions/:id` | 없음 | 공개 세션 복원 |
| POST `/api/sessions/:id/advance` | `{expectedStep, direction?:"next"|"prev"}` | 이론 다음/이전 단계 (기본 next) |
| POST `/api/sessions/:id/check` | `{waveIndices}` | 3점 또는 6점 검증 |
| POST `/api/sessions/:id/hint` | `{kind:"hint"|"example"}` | 허용된 힌트·예시 |
| POST `/api/sessions/:id/plan` | 3점, 가격, 이유 | 계획 확정 |
| POST `/api/sessions/:id/revise` | `{expectedPlanId}` | 기존 계획을 보존하고 새 계획 작성 상태로 전환 |
| POST `/api/sessions/:id/replay` | `{expectedCursor}` | 다음 캔들 한 개와 평가 추가 |
| POST `/api/sessions/:id/evaluate` | 없음 | Binance 이후 확정봉 평가 추가 |
| POST `/api/sessions/:id/reflection` | `{decision, reason}` | 완료 뒤 청산 판단 보존 |
| GET `/api/sessions/:id/export` | 없음 | 세션·계획·평가·JSON Schema 내보내기 |

오류는 `{error:{code,message}}` 형식입니다. 형식·공개 범위 오류는 400, 없는 세션은 404, 중복·stale·잘못된 상태 전이는 409, Binance 조회 오류는 502/503으로 처리합니다. `expectedStep`, `expectedCursor`, `expectedPlanId`와 단일 프로세스 mutation 직렬화가 중복 요청을 막습니다. `SessionView`는 공개 캔들만 포함하고 비공개 미래 OHLC는 API·클라이언트 번들에 넣지 않습니다.

## 도메인 계약과 평가

Zod 실행 스키마와 `z.toJSONSchema` export가 실제 계약입니다. `docs/stock/tutorial-schema.ts`는 이전 확장 초안이며 실행 스키마가 아닙니다. 6점 규칙은 `entities/wave`의 순수 검증기, 3점 선택·Fibonacci·체결 평가는 각각 해당 entity의 순수 함수로 계산합니다. 서버는 클라이언트의 계산 결과를 신뢰하지 않고 저장 시 재검증합니다.

`TradePlan`은 `schemaVersion:"1"`, UUID, revision, `previousPlanId`, 유닛·시나리오·소스, 생성 시각·`asOf`, 공개 캔들 `snapshotId`, 3개 파동점, 가격·이유, Fibonacci, 무효화 가격, 결정별 이유, 청산 전략, `policyVersion:"touch-v1"`를 보존합니다. 확정 계획의 필드는 변경하지 않습니다. `revise` 뒤 새 확정은 revision을 높이고 이전 ID에 연결합니다. 완료된 더미 시나리오는 이후 캔들이 없으므로 revision을 시작할 수 없습니다.

`TradeEvaluation`은 계획 ID, `replay`/`later-market`, 평가·관측 시각, 데이터 식별자, `pending/open/target/stop/indeterminate/expired`, 진입·청산가, R·수익률·위험보상비와 결정별 피드백을 담습니다. Replay는 한 봉 공개 때마다 누적 기록하고 Binance 사후 평가는 같은 계획의 새 기록을 추가합니다. 계산에는 계획 `asOf` 이후 캔들만 입력합니다. OHLC의 선후 불명확성은 `indeterminate`로 남깁니다. 5파 후 회고는 별도 `reflection`이며 평가를 변경하지 않습니다.

## 캔들 데이터·보존

`server/candle-data/registry.ts`가 더미 fixture 또는 Binance Spot 공개 `/api/v3/klines`를 공통 `Candle`로 만듭니다. Binance는 `BTCUSDT`·`ETHUSDT`, `1h`·`4h`·`1d`를 허용하고 완료된 봉만 사용합니다. 세션 생성 시 최대 120봉을 고정하며 초기에는 최대 80봉을 공개합니다. Binance 어댑터는 순서·구간·OHLC·거래량을 검증하고 오류 응답을 정상 데이터로 캐시하지 않습니다. 요청 URL별 프로세스 메모리 캐시의 TTL은 과거 구간 24시간, 최신 구간 30초입니다. 네트워크 오류나 제한은 명시적 오류이며 더미로 자동 대체하지 않습니다.

사후 시장 평가는 계획 이후 최대 1000봉씩 4페이지, 총 4000봉까지 조회합니다. 초과 기간은 현재 평가 한도 오류입니다. 초기 스냅샷과 같은 시간의 데이터가 달라지면 거부하고, 새 확정봉만 뒤에 붙입니다. 4000봉을 넘는 장기 평가·증분 재개는 후속 확장 대상입니다.

`FIBONACCI_DATA_DIR`(기본 프로젝트 `.data/`)의 세션별 JSON에 공개 view와 비공개 전체 스냅샷, 계획별 공개 시점 스냅샷, 사후 캔들을 저장합니다. SHA-256 ID로 데이터 정체성을 표시하며 임시 파일 작성 후 rename으로 교체합니다. 단일 프로세스 mutation을 직렬화하므로 동시 Replay는 한 번만 진행합니다. URL 또는 localStorage의 세션 ID로 재방문하고 서버 재시작 뒤 복원합니다. 인증·공유 DB·다중 인스턴스 잠금·백업·migration은 구현 범위 밖입니다.

## 실행·검증

루트에서 `pnpm --filter fibonacci-tutorial dev`(4310), `storybook`(6310)을 사용합니다. `test`는 Vitest 순수 계산·서비스 테스트, `lint`는 ESLint와 FSD 경계, `typecheck`는 Next 타입 생성을 포함합니다. `test:integration`은 production/Storybook 빌드, 소유한 동적 포트·임시 JSON·Binance stub에서 Bruno API와 Playwright UI/Storybook을 실행하고 동시 Replay·재시작 복원을 확인합니다. `test:api`, `test:e2e`, `test:storybook`은 개별 실행 명령입니다. 이번 통합 검증과 남은 확인의 증거는 [검증 기록](../validation/full-tutorial.md)에 따릅니다.

## 후속 범위

Binance 라이브 네트워크 가용성은 테스트 stub의 통과와 별도로 확인해야 합니다. 장기 4000봉 초과 사후 평가, 다중 사용자·서버 운영, 실제 주문과 인증은 현재 계약 밖입니다.

이론 이전 이동도 `/advance`를 사용하며 현재 단계가 다르면409, 첫 단계 이전은409로 거부합니다. 완료 상태에서 prev는 이전 단계로 이동해 세션 complete를 false로 바꾸고 설명·cursor·공개 캔들·selectedIndices를 서버 스냅샷에서 복원합니다.


## 심화 커리큘럼 실행 계약 — CUR-EW-001

기존9유닛은 `entities/tutorial/content/units`, 신규35유닛은 `entities/lesson/content/units/<unitId>`에 독립적으로 둡니다. 공개 카탈로그와 서버 전용 정의를 분리하며, 정답·반례·전체 OHLC는 서버 모듈에만 존재합니다. 새 유닛은 개별 정의와 공개 catalog, 서버 registry에 등록합니다. 공통 factory는 필드·사례 구성을 재사용하고 패턴 fixture와 순수 validator는 별도 모듈로 관리합니다.

`LessonDefinition`은 이론 단계/문항 또는 사례/필드/비공개 정답을, `LearningView`는 현재 공개 단계·사례·피드백·시점만 표현합니다. 13이론은60봉을12/24/36/48/60으로 공개하고 마지막 단계에서 퀴즈를 제출합니다. 숫자·전환점·패턴 분류·중첩 구간·자기 점검은 해당 필드 계약으로 제출합니다. 구간 ID 고유성·부모 포함·순환·시간순·차수와 Zigzag/Flat의 하위 분할을 순수 함수로 검사합니다.

| HTTP | 입력 | 역할 |
| --- | --- | --- |
| POST `/api/sessions/:id/lesson/check` | answers 또는 caseId/values/rubric | 퀴즈·워크북 검사와 완료 집계 |
| POST `/api/sessions/:id/lesson/case` | caseIndex | 사례별 스냅샷·진행 복원 |
| POST `/api/sessions/:id/analysis/plan` | AnalysisPlan | 공개 시점에 분석 원본 확정 |
| POST `/api/sessions/:id/analysis/revise` | expectedPlanId | 원본을 보존하고 새 revision 시작 |
| POST `/api/sessions/:id/analysis/replay` | expectedCursor | 다음 봉 공개와 분석 평가 기록 |
| POST `/api/sessions/:id/analysis/evaluate` | 없음 | 이후 실제 확정봉 관측 |
| POST `/api/sessions/:id/analysis/reflection` | planId/reason | 해당 계획의 관측 회고 저장 |

`AnalysisPlan`은 주·대안/유보, 방향·차수·부모/자식 구간, 규칙·가이드라인·기준점·무효화·다음 관측 조건, asOf/snapshotId와 선택적 매매 조건을 포함합니다. schemaVersion2 분석 revision이 기존 TradePlan v1과 공존합니다. 서버는 현재 공개 스냅샷 또는 동일 사례의 확정 원본인지 확인하고, Replay 평가에서도 prefix hash 일치를 확인합니다. 분석 평가는 관측 기록이며 주관적 파동 해석을 자동 정답으로 인증하지 않습니다.

사례별 snapshot/cursor, append-only 제출 이력, 통과 기록, 분석 plan/evaluation/reflection을 JSON에 보존합니다. 이전 통과는 후속 실패 답안으로 지우지 않습니다. 최종 포트폴리오는 세 고유 snapshot의 원본·관측·회고를 서버가 집계하며 수동 UUID 입력을 요구하지 않습니다. 클라이언트가 보낸 live observedAt은 수료 근거로 사용하지 않습니다.

H/HR 원본은 `server/candle-data/fixtures`의 실제 Binance 데이터와 SHA-256 manifest로 관리합니다. M의1h480·4h120·1d20은 동일20일이며 공개 종료 시각이 일치하는 닫힌 봉만 반환합니다. L은 기존 캐시 어댑터로 최신 확정봉을 불러옵니다. 과거 자료의 동기화와 최신 네트워크 가용성은 별도 검증합니다.

실행 증거는 [44유닛 검증](../validation/curriculum.md)을 참조합니다.

## 스타일·테마 — UI-PRIMER-001

`@primer/primitives` 공식 light/dark CSS 토큰을 `globals.css`에서 불러온다. html의 data-color-mode/light-theme/dark-theme로 전환하며 기본light, `fibonacci-lab:theme` 선택을 localStorage에 보존한다. 초기에 저장테마를복원하고 `shared/lib/theme`이 같은탭·다른탭 변경을구독한다. 색상은 의미토큰, 폰트는 시스템폰트, 모서리는6px·경계1px를 기본으로한다. 기존Radix UI를 Primer 시각언어로 스타일링하며 Primer React로 전체위젯을교체한것은아니다.

차트 canvas는 계산된 CSS 색상을 읽어 적용하고 테마전환시 재생성한다. 선택·계획데이터는 유지되며 차트뷰는 전체공개구간으로맞춘다. Storybooktoolbar도 같은토큰과테마구독을사용한다. [공식 토큰](https://primer.style/product/primitives/)과 [색상 운영](https://primer.style/product/getting-started/foundations/color-usage/)을 기준으로 한다.

## 전략 실행 모니터링 — SM-001

`entities/strategy-monitor`의 순수 상태 머신이 확정 TradePlan과 이후 Candle을 입력받는다. 확정 입력의 `monitoring`은 서버가 검증해 불변 `monitoringConfig`로 저장한다. 기본 auto-abort는 무효화 시 미진입 취소·보유 모의 청산이며 warn-only도 선택할 수 있다. 상태는 PENDING/OPEN/INVALIDATED_STOP/CLOSED_TP/CLOSED_SL/EXPIRED와 ABORTED/INDETERMINATE다. 모니터링 스키마와 이벤트 스키마를 JSON export에 포함한다.

`SessionView.monitoring`은 현재 실행, `monitoringHistory`는 계획별 실행 이력이다. 구 JSON은 기본 필드로 파싱한 뒤 공개된 봉으로 실행을 복원한다. GET 복원은 원본 파일을 쓰지 않는다. Replay와 later-market 평가가 같은 머신에 새 봉만 순서대로 입력하고 이벤트를 원자 저장한다. 동일 봉 재조회는 중복 이벤트를 만들지 않는다. revision은 이전 이력을 보존한다.

`POST /api/sessions/:id/monitoring/abort`는 `{expectedPlanId,expectedCursor,reason}`를 받고 마지막 공개 종가로 모의 청산한다. stale·이미 종결된 실행은409다. 무효화와 목표의 OHLC 선후가 불명확하면 INDETERMINATE로 남긴다. 최초위험은 entry-stopLoss 원값을 고정하며 수량1·비용0이다. 최신 가격은 관측한 확정봉 종가이며 틱 가격이 아니다.

Binance 자동 감시는 명시적인 시작/중지 동작으로60초마다 기존 평가 API를 호출한다. 중복 요청을 방지하고 화면 이동·계획변경·오류·종결 시 타이머를 정리한다. 서버가 확정봉과 기존 스냅샷의 일치를 검사한다. 거래소 주문은 실행하지 않는다. `TradeEvaluation.monitoringSummary`와 피드백이 실행 결과를 연결하며 기존 touch-v1 가격 비교 결과는 별도로 유지한다.

차트는 확정된 규칙 가격을 보라색 점선으로 표시하고 실행 이벤트를 봉 위치에 표시한다. 모니터링 패널은 건강도·미실현 손익·고정위험 live R·가격/퍼센트 이격도·확정 손익·이벤트·과거 revision을 제공한다. 세부 규칙은 [구현 명세](../design/strategy-monitoring.md)를 따른다.

수동 중단 시 같은 계획의 비교 평가가 있으면 원본을 보존하면서 새 평가 기록에 ABORTED 요약을 추가한다. 아직 평가가 없는 미진입 취소는 실행 이벤트와 export의 `monitoringAudit`에 보존한다.

## 독립 전략 작업 공간 — SM-002 / SM-003

`entities/strategy`는 독립 전략·초안·계획·실행·평가 스키마와 순수 평가 변환을 제공한다. `server/strategies/{data,repository,service,http}.ts`는 데이터·저장·흐름·HTTP 경계다. `views/strategy-workspace`는 목록·새 전략·상세 및 계획 폼을 조합한다. 기존 `strategy-monitor` 순수 함수를 재사용하며 차트와 모니터링 위젯은 필요한 계획 필드만 받는다. 가짜 unitId/sessionId를 생성하지 않는다.

| 경계 | 계약 |
| --- | --- |
| GET `/api/strategies/options` | OHLC 없는 더미 기준 봉·가능한 관측 수 메타데이터 |
| GET/POST `/api/strategies` | 저장 목록 / 초안 생성 |
| GET/PATCH `/api/strategies/:id` | 현재 view / expectedVersion 기반 초안 저장·데이터 갱신 |
| POST `/:id/confirm` | 공개 파동점·가격·무효화 검증 및 불변 계획 확정 |
| POST `/:id/revise` | 새 mode/source/asOf 기준 초안, 기존 plans/runs 보존 |
| POST `/:id/runs` | 확정 계획과 같은 검증 방식의 독립 실행 생성 |
| POST `/:id/runs/:runId/step`, `/batch` | 백테스트 한 봉 / 고정 구간 일괄 실행 |
| POST `/:id/runs/:runId/poll` | 포워드 새 확정봉 또는 더미 순차 입력 |
| POST `/:id/runs/:runId/pause`, `/resume`, `/abort` | 제어 상태와 수동 중단 |
| GET `/:id/export` | canonical strategy, 공개 runAudits, JSON Schema, 체결 가정 |

축약 경로는 `/api/strategies` 아래다. 모든 변경 요청은 expectedVersion을 검증하고 단일 프로세스 직렬화로 오래된 요청을 409 처리한다. 초안의 draftPlan은 저장 요청의 완전한 초안 객체로 교체한다. 부분 파동 선택을 허용하되 공개 범위·순서를 검증하며 확정은 유효한 세 점을 요구한다. 데이터 기준 변경은 초안을 비운다.

`FIBONACCI_DATA_DIR/strategies/:id.json`에 view, 비공개 snapshots, runCandles를 저장한다. 임시 파일+rename으로 교체한다. 읽을 때 이전 실행의 누락 lastError/observedSnapshotId를 기본값·해시로 복원하며 GET은 파일을 쓰지 않는다. 기존 튜토리얼 JSON 계약은 유지한다.

### 실행·시간·데이터 계약

SM-003 요구사항에서 BACKTEST와 FORWARD는 선택 가능한 동등한 실행 방식이다. FORWARD 생성·확정에 과거 BACKTEST 실행의 존재나 성공을 요구하지 않는다. 확정 계획의 mode를 실행 도중 변경하지 않고, 방식 전환은 새 plan revision과 별도 runId로 연결한다.

strategyId → planId/revision → runId로 연결한다. 계획은 source/mode/asOf/스냅샷·파동점·Fibonacci·가격·규칙·근거·touch-v1을 고정한다. run은 WAITING/RUNNING/PAUSED/COMPLETED/ERROR 제어 상태와 별도 매매 상태를 갖는다. initial snapshotId와 실제 공개 입력의 observedSnapshotId를 함께 보존한다. export의 runAudits는 runId를 포함한 이벤트 ID와 공개 캔들을 제공하며 canonical strategy/run의 엄격한 JSON Schema와 구분한다.

Binance 과거 데이터는 캐시 어댑터에서 최대 4000개 후속 확정봉을 가져와 고정한다. 계획 작성에는 기준 봉 이전만 노출하고 백테스트 재생/일괄이 같은 상태 머신을 사용한다. 최종 경제적 결과는 같지만 run ID·실제 기록 시각은 서로 다를 수 있다. 종료 시 미진입은 EXPIRED, 보유는 OPEN/미청산이다.

Binance 포워드 확정은 최신 기준 시각과 스냅샷을 재검증한다. stale draft는 409이며 PATCH refreshData로 최신 기준을 불러와 재작성한다. poll은 마지막 관측 이후 확정봉만 페이지 단위로 조회하며 누락·중복·4000봉 초과를 검증한다. 실패하면 매매 상태·cursor를 유지하고 ERROR/lastError를 저장한다. resume에서 오류를 지우고 다시 조회한다. 최신 가격은 확정봉 종가다.

React Query는 서버 상태를 관리한다. 상세 화면의 60초 감시와 자동 재생은 중복 요청을 방지하고 종료·오류·이동 시 타이머를 정리한다. 브라우저 종료 뒤 서버 백그라운드 처리는 없다. [구현 설계와 검증 시나리오](../design/standalone-strategy-workspace.md)를 따른다.

SM-002/SM-003 구현과 수락 기준별 증거: [독립 전략 검증](../validation/standalone-strategy.md).
