# master-plan 완료 감사

날짜: 2026-09-27. 원본 `master-plan.md`를 그대로 유지하고, 각 섹션을 현재 소스 및 실행 증거와 대조한다. 최초 완료 선언을 근거로 삼지 않고 코드와 테스트 시나리오를 다시 확인했다.

## 원본 섹션별 근거

경로는 프로젝트 루트 기준이다. API·브라우저 결과의 상세 증거는 [전체 검증 보고서](full-tutorial.md)에 있다.

| 원본 섹션 | 현재 구현 근거 | 실행 확인 |
| --- | --- | --- |
| 목표, MVP 범위 | `src/entities/tutorial/index.ts` 3챕터/9유닛; `content/units/` Lesson 1–6 | 카탈로그 API, 전체 UI 흐름 |
| 기술 스택 | `package.json`, `components.json`, `src/app/providers/`, `shared/ui/` | production/Storybook build, lint, typecheck |
| 핵심 UX, UI 구성 | `widgets/tutorial-sidebar`, `widgets/chart-workspace`, `views/tutorial` | 좌측 9유닛, 캔들 클릭, 모바일, 상태 표시 |
| 튜토리얼 구조, 모드 | `unitSchema`, `theoryStepSchema`, `content/server.ts`, `sessions/service.ts` | 이론 단계별 설명·봉 변경, 독립 유닛 왕복 복원 |
| 유닛 모델·디렉터리 | Chapter ID/설명/순서/unitIds; 독립 `content/units/<id>` | `tutorial.test.ts`, 카탈로그 계약 |
| FSD 경계, 구현 원칙 | 계층별 공개 index, 서버 경계, 순수 wave/fibonacci/evaluation | `scripts/check-boundaries.mjs`, 순수 함수 경계 테스트 |
| 차트 데이터 소스 | `server/candle-data/{registry,binance}.ts`, 세션 snapshot | 더미/실 Binance, 정규화·캐시·429·오류 재시도·미래 비공개 |
| 튜토리얼 도메인 지식 | `docs/tutorials/01`–`07` | Lesson/유닛별 데이터·단계·경계 명세 대조 |
| Elliott Wave 검증 | `entities/wave/index.ts`의 validateWave2/3/4 | 경계 단위 검사, 잘못된6점 실패 후 수정 |
| 파동 선택 | `features/count-waves`, candle-chart click, store undo/reset | 실제 캔들 클릭·키보드 선택, Undo/Reset |
| 차트 오버레이 | `candle-chart.tsx` createSeriesMarkers/LineSeries/priceLine | 실제 시각 확인, zoom/pan 뒤 Fibonacci 표시 |
| Fibonacci | `entities/fibonacci`, `chart-workspace/levels.ts` | 38.2/50/61.8%, 1.618 가격 계산·후보 라벨 |
| 매매 연습 | `features/confirm-trade-plan`, 가격 입력·무효화·후보 가격선 | 유효/무효 가격, 확정 전 미래 공개 차단 |
| TradePlan/TradeEvaluation | `entities/trade-plan`, `entities/trade-evaluation`, server confirm/revise/export | 원본 불변, revision, asOf, export JSON Schema, 사후 재평가 |
| Replay | server replay + view Play/Pause | 한 봉 공개, Pause 중 요청 없음, 끝에서 정지, cursor 충돌 |
| 결과 화면, 학습 피드백 | `widgets/evaluation-panel`, plan panel, reflection | entry/exit/stop/target, %, R:R, R, 규칙 이유, 청산 회고 저장 |
| 데이터 모델 | candle/wave/tutorial/trade-plan/trade-evaluation Zod schemas | 요청·저장·응답 파싱, 옛 JSON migration, JSON Schema export |
| 컴포넌트 구조 | 아래 역할 대응표 | 공통 UI를 모든 유닛에서 재사용, Storybook 독립 상태 |
| 상태 관리 | Query 조회/mutation, Zustand wave draft, 로컬 Play/입력 | 이동·새로고침·새 세션·재시작 복원, 완료 누적 회귀 |
| Walking Skeleton | 기존 flow/검증 기록과 확장된 첫 wave-three 경로 | 기존 3개 E2E 유지 + 전체 유닛 확장 검사 |
| 완료 조건 전체 | OHLC/5파/3규칙/Fibonacci/Replay/계획/평가/이론·연습 | 자동 검사와 실제 UI·Binance 탐색의 FT-01–14 결과 |

## 컴포넌트 역할 대응

계획의 이름은 역할을 나타낸다. 실제 파일은 FSD 책임에 맞추어 다음과 같이 구성한다.

| 계획 역할 | 실행 코드 |
| --- | --- |
| ElliottTutorial | `views/tutorial`의 TutorialView/TutorialWorkspace |
| Chart | `widgets/chart-workspace/candle-chart.tsx`의 CandleChart |
| WaveSelector | `features/count-waves` + ChartWorkspace의 캔들 선택 |
| WaveOverlay, FibonacciOverlay | CandleChart의 marker/line/priceLine + `levels.ts` |
| ReplayController | TutorialWorkspace의 Next Candle/Play/Pause 및 mutation |
| ValidationPanel | WaveValidationPreview + 저장된 validation 피드백 |
| TradeSimulator | 서버 replay/evaluate와 순수 evaluateLongPlan |
| TutorialSidebar | `widgets/tutorial-sidebar`의 TutorialSidebar |

필드 이름도 실행 스키마를 따른다. 계획의 planId/evaluationId는 각 레코드의 `id`, 마지막 공개봉 시각은 계획의 `asOf`, 관측 구간은 `observedFrom`/`observedThrough`로 보존한다. 기준 시각에 마지막 공개봉만 사용하며 이후 봉은 평가에서 분리한다. 시작점 W0를 포함한 6점으로 1–5파의 길이를 검증한다.

## 감사에서 발견해 보완한 사항

1. 선택 완료 직후 자동 규칙 표시를 추가했다. `WaveValidationPreview`는 공개된6점만 순수 validator에 넘기며 정답·미래 데이터를 읽지 않는다. `Check Answer`는 서버 재검증과 결과 저장을 수행한다.
2. 재방문 후 새로운 유닛을 완료할 때 localStorage의 기존 완료 ID와 현재 완료를 합친다. 두 이론 유닛을 다른 페이지 방문에서 완료하고 새로고침하는 회귀 시나리오로 확인한다.

최종 상태: PASS. 전체 요구의 구현·검증 근거를 확인했으며 남은 필수 구현은 없다. 2026-09-27 통합 재실행: production/Storybook build, Bruno48, UI10, Storybook10, 재시작·동시성 PASS. 단위29, lint/FSD, typecheck PASS. 로그 `/tmp/fibonacci-completion-audit.log`와 생성된 보고서에서 실제 결과를 확인했다. 소유 포트·PID·임시 데이터 정리도 확인했다.
