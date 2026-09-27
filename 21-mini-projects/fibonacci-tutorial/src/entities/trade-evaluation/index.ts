import { z } from "zod";
import type { Candle } from "@/entities/candle/@x";
import type { TradePlan } from "@/entities/trade-plan/@x";
import { validationResultSchema } from "@/entities/wave/@x";

export const evaluationStatusSchema = z.enum(["pending", "open", "target", "stop", "indeterminate", "expired"]);
export type EvaluationStatus = z.infer<typeof evaluationStatusSchema>;

export const tradeEvaluationSchema = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  evaluatedAt: z.iso.datetime(),
  observedThrough: z.number().int().nonnegative(),
  status: evaluationStatusSchema,
  entryPrice: z.number().finite().positive().nullable(),
  exitPrice: z.number().finite().positive().nullable(),
  resultR: z.number().finite().nullable(),
  reason: z.string().min(1),
  schemaVersion: z.literal("1").default("1"),
  evaluationMode: z.enum(["replay", "later-market"]).default("replay"),
  observedFrom: z.number().int().nonnegative().default(0),
  snapshotId: z.string().default("legacy"),
  returnPercent: z.number().finite().nullable().default(null),
  riskRewardRatio: z.number().finite().positive().nullable().default(null),
  feedback: z.array(validationResultSchema).default([]),
  monitoringSummary: z.string().optional(),
});
export type TradeEvaluation = z.infer<typeof tradeEvaluationSchema>;
export const tradeEvaluationJsonSchema = z.toJSONSchema(tradeEvaluationSchema);
export type EvaluationResult = Pick<TradeEvaluation, "status" | "entryPrice" | "exitPrice" | "resultR" | "reason">;

/** Evaluate only candles revealed after the immutable plan's asOf time. */
export function evaluateLongPlan(plan: TradePlan, observedCandles: readonly Candle[], isFinalCandle: boolean): EvaluationResult {
  let entryPrice: number | null = null;

  for (const candle of observedCandles) {
    if (candle.time <= plan.asOf) throw new Error("평가 캔들은 계획 기준 시각 이후여야 합니다.");

    if (entryPrice === null) {
      const fillsAtOpen = candle.open >= plan.entry;
      const touchesEntry = candle.low <= plan.entry && candle.high >= plan.entry;
      if (!fillsAtOpen && !touchesEntry) continue;
      entryPrice = fillsAtOpen ? candle.open : plan.entry;
      if (fillsAtOpen) {
        if (candle.open >= plan.target) {
          return outcome("target", entryPrice, candle.open, 0, "캔들 시가에서 진입과 목표에 동시에 도달했습니다.");
        }
        const openEntryExit = determineExit(candle, plan, entryPrice);
        if (openEntryExit !== null) return openEntryExit;
      } else if (candle.low <= plan.stopLoss || candle.high >= plan.target) {
        return outcome("indeterminate", entryPrice, null, null, "같은 OHLC 캔들에서 진입과 청산 가격에 닿아 선후를 알 수 없습니다.");
      }
      continue;
    }

    const exit = determineExit(candle, plan, entryPrice);
    if (exit !== null) return exit;
  }

  if (entryPrice !== null) return outcome("open", entryPrice, null, null, "포지션이 열려 있으며 청산 가격에 아직 닿지 않았습니다.");
  if (isFinalCandle) return outcome("expired", null, null, null, "시나리오가 끝날 때까지 진입하지 않았습니다.");
  return outcome("pending", null, null, null, "진입 가격에 아직 닿지 않았습니다.");
}

function determineExit(candle: Candle, plan: TradePlan, entryPrice: number): EvaluationResult | null {
  if (candle.open <= plan.stopLoss) {
    return outcome("stop", entryPrice, candle.open, calculateR(entryPrice, candle.open, plan.stopLoss), "캔들 시가에서 손절 가격을 넘어섰습니다.");
  }
  if (candle.open >= plan.target) {
    return outcome("target", entryPrice, candle.open, calculateR(entryPrice, candle.open, plan.stopLoss), "캔들 시가에서 목표 가격을 넘어섰습니다.");
  }
  const touchesStop = candle.low <= plan.stopLoss;
  const touchesTarget = candle.high >= plan.target;
  if (touchesStop && touchesTarget) {
    return outcome("indeterminate", entryPrice, null, null, "같은 OHLC 캔들에서 손절과 목표에 모두 닿아 선후를 알 수 없습니다.");
  }
  if (touchesStop) {
    return outcome("stop", entryPrice, plan.stopLoss, calculateR(entryPrice, plan.stopLoss, plan.stopLoss), "손절 가격에 도달했습니다.");
  }
  if (touchesTarget) {
    return outcome("target", entryPrice, plan.target, calculateR(entryPrice, plan.target, plan.stopLoss), "목표 가격에 도달했습니다.");
  }
  return null;
}

function outcome(status: EvaluationStatus, entryPrice: number | null, exitPrice: number | null, resultR: number | null, reason: string): EvaluationResult {
  return { status, entryPrice, exitPrice, resultR, reason };
}

function calculateR(entry: number, exit: number, stopLoss: number): number | null {
  const risk = entry - stopLoss;
  if (risk <= 0) return null;
  return Math.round(((exit - entry) / risk + Number.EPSILON) * 1000000) / 1000000;
}

/** Prices are expressed per unit; fees and slippage are zero under touch-v1. */
export function tradeMetrics(plan: Pick<TradePlan, "entry" | "stopLoss" | "target">, entryPrice: number | null, exitPrice: number | null): { returnPercent: number | null; riskRewardRatio: number | null } {
  const riskRewardRatio = (plan.target - plan.entry) / (plan.entry - plan.stopLoss);
  const returnPercent = entryPrice !== null && exitPrice !== null ? ((exitPrice - entryPrice) / entryPrice) * 100 : null;
  return {
    returnPercent: returnPercent === null ? null : Math.round(returnPercent * 1000000) / 1000000,
    riskRewardRatio: Number.isFinite(riskRewardRatio) && riskRewardRatio > 0 ? Math.round(riskRewardRatio * 1000000) / 1000000 : null,
  };
}
