import { z } from 'zod';

// ----------------------------------------------------------------------
// 1. 차트 데이터 소스 (CandleSource)
// master-plan.md: 'dummy'와 'binance' 소스 선택
// ----------------------------------------------------------------------
export const CandleSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("dummy"),
    scenarioId: z.string().describe("재현 가능한 고정 OHLC 시나리오 ID (예: 'impulse-wave-1')"),
  }),
  z.object({
    type: z.literal("binance"),
    symbol: z.string().describe("Binance 심볼 (예: 'BTCUSDT')"),
    interval: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]).describe("캔들 간격"),
    startTime: z.number().optional().describe("조회 시작 시간 (Unix Timestamp ms)"),
    endTime: z.number().optional().describe("조회 종료 시간 (Unix Timestamp ms)"),
  }),
]);

export const ChartScenarioSchema = z.object({
  source: CandleSourceSchema,
  initialVisibleCandles: z.number().min(1).describe("유닛 진입 시 초기에 보여줄 캔들 개수"),
  totalCandles: z.number().describe("시나리오의 전체 캔들 개수 (Replay 최대 범위)"),
});

// ----------------------------------------------------------------------
// 2. 이론 모드 데이터 모델 (Theory Mode)
// ----------------------------------------------------------------------
export const TheoryStepSchema = z.object({
  stepIndex: z.number(),
  content: z.string().describe("마크다운 형식의 설명 (예: 'Wave 3은 가장 짧을 수 없습니다.')"),
  chartState: z.object({
    revealCandlesTo: z.number().optional().describe("이 단계에서 차트에 표시할 캔들 인덱스"),
    showWaves: z.array(z.number()).optional().describe("표시할 엘리어트 파동 번호 (예: [1, 2])"),
    showFibonacci: z.boolean().optional().describe("피보나치 되돌림/확장 표시 여부"),
  }).describe("Next 버튼을 누를 때마다 갱신될 차트 상태"),
});

// ----------------------------------------------------------------------
// 3. 연습 모드 데이터 모델 (Practice Mode)
// ----------------------------------------------------------------------
export const PracticeConfigSchema = z.object({
  allowedActions: z.array(
    z.enum(["select_wave", "set_entry", "set_stop_loss", "set_target", "replay"])
  ).describe("학습자가 수행할 수 있는 허용 동작"),
  completionConditions: z.array(
    z.enum(["wave_validation_passed", "trade_finished", "profit_target_reached", "stop_loss_hit"])
  ).describe("유닛 완료 기준"),
  customFeedback: z.record(z.string()).optional().describe("특정 에러에 대한 커스텀 피드백 메시지 맵핑"),
});

// ----------------------------------------------------------------------
// 4. 튜토리얼 유닛 (Tutorial Unit)
// ----------------------------------------------------------------------
const BaseTutorialUnitSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  title: z.string(),
  learningObjectives: z.array(z.string()),
  scenario: ChartScenarioSchema,
});

export const TutorialUnitSchema = z.discriminatedUnion("mode", [
  BaseTutorialUnitSchema.extend({
    mode: z.literal("theory"),
    steps: z.array(TheoryStepSchema).min(1).describe("순서 있는 설명 단계들"),
  }),
  BaseTutorialUnitSchema.extend({
    mode: z.literal("practice"),
    description: z.string().describe("연습 과제 설명"),
    practice: PracticeConfigSchema,
  }),
]);

// ----------------------------------------------------------------------
// 5. 챕터 (Chapter)
// ----------------------------------------------------------------------
export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number(),
  unitIds: z.array(z.string()).describe("이 챕터에 속한 TutorialUnit ID 목록"),
});

// ----------------------------------------------------------------------
// Types (TypeScript)
// ----------------------------------------------------------------------
export type CandleSource = z.infer<typeof CandleSourceSchema>;
export type ChartScenario = z.infer<typeof ChartScenarioSchema>;
export type TheoryStep = z.infer<typeof TheoryStepSchema>;
export type PracticeConfig = z.infer<typeof PracticeConfigSchema>;
export type TutorialUnit = z.infer<typeof TutorialUnitSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
