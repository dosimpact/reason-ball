import { z } from "zod";
import { candleSchema } from "@/entities/candle/@x";
import { wavePointSchema } from "@/entities/wave/@x";
import { decisionReasonsSchema } from "@/entities/trade-plan/@x";
import { monitoringConfigSchema, monitoringInputSchema, monitoringStateSchema } from "@/entities/strategy-monitor/@x";
import { fibonacciSchema } from "@/entities/fibonacci/@x";

export const strategyModeSchema = z.enum(["BACKTEST", "FORWARD"]);
export const strategySourceSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("dummy") }),
  z.strictObject({ type: z.literal("binance"), symbol: z.enum(["BTCUSDT", "ETHUSDT"]), interval: z.enum(["1h", "4h", "1d"]) }),
]);
export const strategyDraftInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(120), mode: strategyModeSchema,
  source: strategySourceSchema, asOf: z.number().int().nonnegative().optional(),
  backtestBars: z.number().int().min(1).max(4000).default(4),
});
export const strategyDraftUpdateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(), title: z.string().trim().min(1).max(120).optional(),
  asOf: z.number().int().nonnegative().optional(), refreshData: z.boolean().optional(),
  draftPlan: z.strictObject({
    waveIndices: z.array(z.number().int().nonnegative()).max(3).optional(),
    entry: z.number().finite().positive().nullable().optional(), stopLoss: z.number().finite().positive().nullable().optional(),
    target: z.number().finite().positive().nullable().optional(), rationale: z.string().max(2000).optional(),
    decisionReasons: z.strictObject({
      wave: z.string().max(2000).optional(), fibonacci: z.string().max(2000).optional(),
      entry: z.string().max(2000).optional(), stopLoss: z.string().max(2000).optional(),
      target: z.string().max(2000).optional(), invalidation: z.string().max(2000).optional(),
      exit: z.string().max(2000).optional(),
    }).optional(), exitStrategy: z.string().max(2000).optional(),
    monitoring: monitoringInputSchema.optional(),
  }).optional(),
});
export const strategyConfirmInputSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  waveIndices: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().nonnegative()]),
  entry: z.number().finite().positive(), stopLoss: z.number().finite().positive(), target: z.number().finite().positive(),
  rationale: z.string().trim().min(1).max(2000),
  decisionReasons: decisionReasonsSchema.optional(), exitStrategy: z.string().trim().min(1).max(2000).optional(),
  monitoring: monitoringInputSchema.optional(),
});
export const strategyReviseInputSchema = z.strictObject({ expectedVersion: z.number().int().positive(), mode: strategyModeSchema.optional(), source: strategySourceSchema.optional(), asOf: z.number().int().nonnegative().optional() });
export const strategyRunInputSchema = z.strictObject({ expectedVersion: z.number().int().positive(), mode: strategyModeSchema });
export const strategyActionInputSchema = z.strictObject({ expectedVersion: z.number().int().positive() });
export const strategyAbortInputSchema = strategyActionInputSchema.extend({ reason: z.string().trim().min(1).max(2000) });

export const strategyPlanSchema = z.strictObject({
  schemaVersion: z.literal("1"), id: z.uuid(), strategyId: z.uuid(), revision: z.number().int().positive(),
  previousPlanId: z.uuid().nullable(), createdAt: z.iso.datetime(), asOf: z.number().int().nonnegative(),
  snapshotId: z.string().min(1), source: strategySourceSchema, mode: strategyModeSchema,
  wavePoints: z.tuple([wavePointSchema, wavePointSchema, wavePointSchema]),
  entry: z.number().finite().positive(), stopLoss: z.number().finite().positive(), target: z.number().finite().positive(),
  fibonacci: fibonacciSchema,
  invalidationPrice: z.number().finite().positive(), rationale: z.string().min(1),
  decisions: decisionReasonsSchema.optional(), exitStrategy: z.string().min(1),
  monitoringConfig: monitoringConfigSchema, policyVersion: z.literal("touch-v1"),
});
export const strategyEvaluationSchema = z.strictObject({
  asOf: z.number().int().nonnegative(), observedThrough: z.number().int().nonnegative(), observedCount: z.number().int().nonnegative(),
  status: monitoringStateSchema.shape.status, entryPrice: z.number().finite().positive().nullable(),
  exitPrice: z.number().finite().positive().nullable(), realizedR: z.number().finite().nullable(),
  realizedPnl: z.number().finite().nullable(),
  unrealizedPnl: z.number().finite().nullable(), liveR: z.number().finite().nullable(),
  indeterminate: z.boolean(), reason: z.string().nullable(),
});
export const strategyRunSchema = z.strictObject({
  id: z.uuid(), strategyId: z.uuid(), planId: z.uuid(), revision: z.number().int().positive(),
  mode: strategyModeSchema, source: strategySourceSchema, snapshotId: z.string().min(1),
  policyVersion: z.literal("touch-v1"), controlStatus: z.enum(["WAITING", "RUNNING", "PAUSED", "COMPLETED", "ERROR"]),
  lastError: z.strictObject({ code: z.string().min(1), message: z.string().min(1), at: z.iso.datetime() }).nullable(),
  startedAt: z.iso.datetime(), endedAt: z.iso.datetime().nullable(), lastObservedAt: z.iso.datetime().nullable(),
  dataRange: z.strictObject({ startTime: z.number().int().nonnegative(), endTime: z.number().int().nonnegative() }),
  cursor: z.number().int().nonnegative(), observedCount: z.number().int().nonnegative(),
  observedSnapshotId: z.string().min(1),
  monitoring: monitoringStateSchema, evaluation: strategyEvaluationSchema,
});
export const strategyDatasetSchema = z.strictObject({
  label: z.string().min(1), kind: z.enum(["dummy-simulation", "binance-historical", "binance-live"]),
  symbol: z.string().nullable(), interval: z.string().nullable(), rangeStart: z.number().int().nonnegative(),
  rangeEnd: z.number().int().nonnegative(), availableCount: z.number().int().positive(),
});
export const strategyViewSchema = z.strictObject({
  id: z.uuid(), title: z.string().min(1), mode: strategyModeSchema, source: strategySourceSchema,
  status: z.enum(["DRAFT", "CONFIRMED"]), version: z.number().int().positive(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), asOf: z.number().int().nonnegative(),
  snapshotId: z.string().min(1), visibleCandles: z.array(candleSchema).min(1),
  dataset: strategyDatasetSchema, backtestBars: z.number().int().min(1).max(4000),
  draftPlan: strategyDraftUpdateSchema.shape.draftPlan.unwrap().default({}),
  plan: strategyPlanSchema.nullable(), plans: z.array(strategyPlanSchema),
  runs: z.array(strategyRunSchema), activeRunId: z.uuid().nullable(),
});
export const strategySummarySchema = strategyViewSchema.pick({
  id: true, title: true, mode: true, source: true, status: true, asOf: true, updatedAt: true,
}).extend({ latestRun: strategyRunSchema.nullable() });

export type StrategyMode = z.infer<typeof strategyModeSchema>;
export type StrategySource = z.infer<typeof strategySourceSchema>;
export type StrategyDraftInput = z.input<typeof strategyDraftInputSchema>;
export type StrategyConfirmInput = z.infer<typeof strategyConfirmInputSchema>;
export type StrategyPlan = z.infer<typeof strategyPlanSchema>;
export type StrategyRun = z.infer<typeof strategyRunSchema>;
export type StrategyView = z.infer<typeof strategyViewSchema>;
export type StrategySummary = z.infer<typeof strategySummarySchema>;

export function evaluateStrategyRun(run: StrategyRun): StrategyRun["evaluation"] {
  const { monitoring, observedCount } = run;
  return {
    asOf: run.monitoring.events[0].candleTime, observedThrough: monitoring.observedThrough,
    observedCount, status: monitoring.status, entryPrice: monitoring.entryFillPrice,
    exitPrice: monitoring.exitPrice, realizedR: monitoring.realizedR,
    realizedPnl: monitoring.entryFillPrice !== null && monitoring.exitPrice !== null ? monitoring.exitPrice - monitoring.entryFillPrice : null,
    unrealizedPnl: monitoring.unrealizedPnl, liveR: monitoring.liveR,
    indeterminate: monitoring.status === "INDETERMINATE",
    reason: monitoring.events.at(-1)?.reason ?? null,
  };
}
