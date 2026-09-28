import { z } from "zod";
import { learningViewSchema, analysisStateSchema } from "@/entities/lesson/@x";
import { monitoringStateSchema } from "@/entities/strategy-monitor/@x";
import { candleSchema } from "@/entities/candle/@x";
import { tradePlanSchema, sourceConfigSchema } from "@/entities/trade-plan/@x";
import { tradeEvaluationSchema } from "@/entities/trade-evaluation/@x";
import { validationResultSchema } from "@/entities/wave/@x";

export const unitSchema = z.strictObject({
  id: z.string().min(1), title: z.string().min(1), mode: z.enum(["practice", "theory"]), description: z.string().min(1),
  chapterId: z.string().min(1), objectives: z.array(z.string().min(1)).min(1),
  task: z.enum(["theory", "count", "fibonacci", "trade", "analysis"]), selectionCount: z.union([z.literal(0), z.literal(3), z.literal(6)]),
  allowedSources: z.array(z.enum(["dummy", "binance"])).min(1), completionCriteria: z.string().min(1),
});
export type UnitSummary = z.infer<typeof unitSchema>;
export const chapterSchema = z.strictObject({ id: z.string().min(1), title: z.string().min(1), description: z.string().min(1), order: z.number().int().nonnegative(), unitIds: z.array(z.string().min(1)).min(1), units: z.array(unitSchema).min(1) });
export const catalogSchema = z.strictObject({ chapters: z.array(chapterSchema).min(1) });
export type Catalog = z.infer<typeof catalogSchema>;
export const catalogJsonSchema = z.toJSONSchema(catalogSchema);

export const catalog: Catalog = {
  chapters: [
    { id: "basics", title: "상승 파동의 기초", description: "Impulse 구조와 세 가지 규칙을 익힙니다.", order: 1, unitIds: ["impulse-theory", "wave-counting", "rules-theory", "rules-practice"], units: [
      { id: "impulse-theory", chapterId: "basics", title: "1. 상승 Impulse 구조", mode: "theory", description: "상승 5파 구조와 조정 파동을 익힙니다.", objectives: ["상승파와 조정파 구분", "시작점과 1–5파 끝점 식별"], task: "theory", selectionCount: 6, allowedSources: ["dummy"], completionCriteria: "모든 이론 단계를 마친다." },
      { id: "wave-counting", chapterId: "basics", title: "2. 파동 카운팅", mode: "practice", description: "시작점과 1–5파의 끝점을 표시합니다.", objectives: ["시간순 전환점 6개 선택", "공개된 캔들로 카운팅 근거 설명"], task: "count", selectionCount: 6, allowedSources: ["dummy"], completionCriteria: "유효한 6점 카운팅을 제출한다." },
      { id: "rules-theory", chapterId: "basics", title: "3. Impulse의 3대 규칙", mode: "theory", description: "불변 규칙과 선택형 가이드라인을 구분합니다.", objectives: ["Wave 2·3·4 규칙 확인", "가이드라인과 불변 규칙 구분"], task: "theory", selectionCount: 6, allowedSources: ["dummy"], completionCriteria: "각 규칙을 학습하고 마지막 단계를 마친다." },
      { id: "rules-practice", chapterId: "basics", title: "3. 규칙 검증 연습", mode: "practice", description: "6점 카운팅을 선택하고 각 규칙을 검증합니다.", objectives: ["3대 규칙 적용", "실패한 카운팅 수정"], task: "count", selectionCount: 6, allowedSources: ["dummy"], completionCriteria: "Impulse 구조와 3대 규칙을 모두 통과한다." },
    ] },
    { id: "planning", title: "진입 계획", description: "Wave 3과 Fibonacci 근거로 계획을 세웁니다.", order: 2, unitIds: ["wave-three", "fibonacci-theory", "fibonacci-practice"], units: [
      { id: "wave-three", chapterId: "planning", title: "4. Wave 3 매매 연습", mode: "practice", description: "시작점과 1–2파를 표시하고 계획을 확정한 뒤 Replay로 평가합니다.", objectives: ["카운팅 무효화와 Stop Loss 구분", "Replay 전에 진입·손절·목표와 근거 기록"], task: "trade", selectionCount: 3, allowedSources: ["dummy"], completionCriteria: "계획을 확정하고 Replay 평가를 마친다." },
      { id: "fibonacci-theory", chapterId: "planning", title: "5. Fibonacci 가격", mode: "theory", description: "되돌림과 확장을 후보 가격대로 살펴봅니다.", objectives: ["38.2%·50%·61.8% 되돌림 계산", "1.618 확장 해석"], task: "theory", selectionCount: 3, allowedSources: ["dummy"], completionCriteria: "모든 이론 단계를 마친다." },
      { id: "fibonacci-practice", chapterId: "planning", title: "5. Fibonacci 연습", mode: "practice", description: "시작점과 1–2파를 선택해 가격대를 계산합니다.", objectives: ["Wave 1 구간 기준점 설정", "되돌림과 목표 후보 비교"], task: "fibonacci", selectionCount: 3, allowedSources: ["dummy"], completionCriteria: "유효한 3점 기준을 제출한다." },
    ] },
    { id: "review", title: "평가와 회고", description: "결과를 평가하고 이후 시장을 다시 살펴봅니다.", order: 3, unitIds: ["trade-review", "market-lab"], units: [
      { id: "trade-review", chapterId: "review", title: "6. 청산 회고", mode: "practice", description: "계획과 Replay 결과를 비교하고 청산 판단을 회고합니다.", objectives: ["R과 수익률 해석", "5파 후 조정 위험 검토"], task: "trade", selectionCount: 3, allowedSources: ["dummy"], completionCriteria: "Replay 평가와 청산 회고를 마친다." },
      { id: "market-lab", chapterId: "review", title: "6. 시장 재평가", mode: "practice", description: "더미 또는 공개 Spot 데이터를 고정하고 나중에 재평가합니다.", objectives: ["원본 계획 불변성 유지", "이후 확정봉과 Replay 결과 비교"], task: "trade", selectionCount: 3, allowedSources: ["dummy", "binance"], completionCriteria: "계획을 확정하고 관측 캔들을 평가한다." },
    ] },
  ],
};

const advancedChapters = [
  ["ew-measurement", "파동의 가격·시간 측정", "Fibonacci 기준점·채널·후보 구간", ["ew-fib-anchors|Fibonacci 기준점과 방향|theory", "ew-fib-measure|되돌림·확장 직접 측정|practice", "ew-wave-proportions|파동 간 비율·교대·균등|theory", "ew-channel-time|채널과 시간 비례|practice", "ew-target-zones|목표 구간과 실패 사례|practice"]],
  ["ew-impulse-depth", "Impulse 내부 구조와 변형", "차수·하락파·연장·절단", ["ew-degree-structure|차수와 내부 5–3–5–3–5|theory", "ew-bearish-impulse|하락 Impulse 카운팅|practice", "ew-extension|1·3·5파 연장|theory", "ew-truncation|5파 절단과 오인 구별|practice", "ew-impulse-audit|Impulse 사례 감사|practice"]],
  ["ew-simple-corrections", "ABC 조정파: Zigzag와 Flat", "내부 분할·유형·진행 중 해석", ["ew-correction-map|조정파를 읽는 순서|theory", "ew-zigzag|Zigzag와 5–3–5|practice", "ew-flat-variants|Flat와 3–3–5|theory", "ew-flat-classify|Flat 유형 비교|practice", "ew-correction-replay|진행 중 ABC 판단|practice"]],
  ["ew-complex-corrections", "Triangle과 복합 조정", "ABCDE·WXY·판정 유보", ["ew-triangle-structure|Triangle의 위치와 분할|theory", "ew-triangle-count|ABCDE와 경계선|practice", "ew-combination-structure|WXY와 WXYXZ|theory", "ew-combination-count|복합 조정 분해|practice", "ew-complex-ambiguity|복잡한 횡보에서 유보|practice"]],
  ["ew-diagonals", "Diagonal과 경계 사례", "Leading·Ending·위치·별도 규칙", ["ew-diagonal-context|Diagonal은 별도 패턴|theory", "ew-ending-diagonal|Ending Diagonal 식별|practice", "ew-leading-diagonal|Leading Diagonal과 해석 범위|theory", "ew-diagonal-versus-impulse|겹침만으로 판단하지 않기|practice", "ew-diagonal-replay|완료 후보와 재해석|practice"]],
  ["ew-alternates", "차수·시간봉·대안 카운팅", "시점 정렬·복수 해석·변경 이력", ["ew-multiscale|차수와 시간봉의 차이|theory", "ew-aligned-count|1h·4h·1d 시점 맞추기|practice", "ew-alternates|주 카운팅·대안·보류|theory", "ew-alternate-replay|가설 변경 이력|practice", "ew-no-count|카운팅하지 않는 선택|practice"]],
  ["ew-analysis", "파동 분석 계획과 종합 평가", "블라인드 분석·실전 재평가·분석 포트폴리오", ["ew-analysis-contract|분석 계획을 확정하는 법|theory", "ew-blind-analysis|블라인드 파동 분석|practice", "ew-outcome-review|틀린 분석·맞은 손익 구별|practice", "ew-live-followup|시간 경과 후 재평가|practice", "ew-final-portfolio|최종 분석 포트폴리오|practice"]],
] as const;
for (const [id,title,description,rows] of advancedChapters) {
  const units: UnitSummary[] = rows.map((row) => {
    const [unitId,unitTitle,mode]=row.split("|");
    return {id:unitId,title:unitTitle,mode:mode as "theory"|"practice",description,chapterId:id,objectives:[unitTitle,description],task:mode==="theory"?"theory":"analysis",selectionCount:0,allowedSources:id==="ew-alternates"||id==="ew-analysis"?["binance"]:["dummy"],completionCriteria:mode==="theory"?"5단계와 확인 질문 2/3":"기본·반례·평가 사례의 객관 검사와 근거 제출"};
  });
  catalog.chapters.push({id,title,description,order:catalog.chapters.length+1,unitIds:units.map((unit)=>unit.id),units});
}

export function getUnitSummary(unitId: string): UnitSummary {
  const unit = catalog.chapters.flatMap((chapter) => chapter.units).find((item) => item.id === unitId);
  if (!unit) throw new Error(`Unknown tutorial unit: ${unitId}`);
  return unit;
}

export const theoryStepSchema = z.strictObject({ title: z.string().min(1), description: z.string().min(1), visibleCount: z.number().int().positive(), waveIndices: z.array(z.number().int().nonnegative()), showFibonacci: z.boolean() });
export type TheoryStep = z.infer<typeof theoryStepSchema>;
export const sourceConfigSchemaForTutorial = sourceConfigSchema;
export { sourceConfigSchema };
export type { SourceConfig } from "@/entities/trade-plan/@x";
export const createSessionInputSchema = z.strictObject({ unitId: z.string().min(1), source: sourceConfigSchema.default({ type: "dummy" }) });
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
export const createSessionInputJsonSchema = z.toJSONSchema(createSessionInputSchema);
export const replayInputSchema = z.strictObject({ expectedCursor: z.number().int().nonnegative() });
export type ReplayInput = z.infer<typeof replayInputSchema>;
export const replayInputJsonSchema = z.toJSONSchema(replayInputSchema);
export const advanceInputSchema = z.strictObject({ expectedStep: z.number().int().nonnegative(), direction: z.enum(["next", "prev"]).default("next") });
export const checkInputSchema = z.strictObject({ waveIndices: z.array(z.number().int().nonnegative()) });
export const hintInputSchema = z.strictObject({ kind: z.enum(["hint", "example"]) });
export const reviseInputSchema = z.strictObject({ expectedPlanId: z.uuid() });
export const reflectionInputSchema = z.strictObject({ decision: z.enum(["close", "hold"]), reason: z.string().trim().min(1).max(2000) });
export const reflectionSchema = reflectionInputSchema.extend({ createdAt: z.iso.datetime(), asOf: z.number().int().nonnegative(), planId: z.uuid() });
export const sessionViewSchema = z.strictObject({
  id: z.uuid(), unitId: z.string().min(1), cursor: z.number().int().nonnegative(),
  visibleCandles: z.array(candleSchema), totalCandles: z.number().int().positive(),
  plan: tradePlanSchema.nullable(), evaluations: z.array(tradeEvaluationSchema), complete: z.boolean(),
  unit: unitSchema.default(getUnitSummary("wave-three")), source: sourceConfigSchema.default({ type: "dummy" }),
  theoryStep: z.number().int().nonnegative().default(0), theoryStepCount: z.number().int().nonnegative().default(0),
  instruction: z.strictObject({ title: z.string(), description: z.string(), showFibonacci: z.boolean() }).default({ title: "", description: "", showFibonacci: false }),
  selectedIndices: z.array(z.number().int().nonnegative()).default([]), validation: z.array(validationResultSchema).default([]),
  hint: z.string().nullable().default(null), exampleIndices: z.array(z.number().int().nonnegative()).nullable().default(null),
  plans: z.array(tradePlanSchema).default([]), reflection: reflectionSchema.nullable().default(null),
  learning: learningViewSchema.nullable().default(null), analysis: analysisStateSchema.nullable().default(null),
  monitoring: monitoringStateSchema.nullable().default(null), monitoringHistory: z.array(monitoringStateSchema).default([]),
});
export type SessionView = z.infer<typeof sessionViewSchema>;
export const sessionViewJsonSchema = z.toJSONSchema(sessionViewSchema);
export { validationResultSchema };
export type { ValidationResult } from "@/entities/wave/@x";
export type { Candle } from "@/entities/candle/@x";
export type { WavePoint } from "@/entities/wave/@x";
export type { ConfirmPlanInput, TradePlan } from "@/entities/trade-plan/@x";
export type { TradeEvaluation } from "@/entities/trade-evaluation/@x";
