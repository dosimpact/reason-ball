import { describe, expect, it } from "vitest";
import type { Candle } from "@/entities/candle/@x";
import { evaluateLongPlan, tradeEvaluationSchema, tradeMetrics } from "@/entities/trade-evaluation";
import { tradePlanSchema } from "@/entities/trade-plan/@x";

const plan = tradePlanSchema.parse({
  schemaVersion: "1", id: "2b261cc5-d0ab-4f65-b41d-b3d04e4b88ea", sessionId: "e85c010d-c639-426d-a03b-b5699f305fa5",
  unitId: "wave-three", createdAt: "2026-09-27T00:00:00.000Z", asOf: 10, snapshotId: "test", source: "dummy",
  wavePoints: [
    { wave: 0, candleIndex: 0, time: 1, price: 100 },
    { wave: 1, candleIndex: 3, time: 4, price: 120 },
    { wave: 2, candleIndex: 6, time: 7, price: 110 },
  ],
  entry: 114, stopLoss: 99, target: 142.36, rationale: "test", fibonacci: { retracement: 0.5, extension1618: 142.36 },
  policyVersion: "touch-v1",
});

function candle(time: number, open: number, high: number, low: number, close = open): Candle {
  return { time, open, high, low, close };
}

describe("long trade evaluation", () => {
  it("waits for entry, then records a target with R", () => {
    const pending = candle(11, 110, 113, 109);
    const entry = candle(12, 112, 120, 111);
    const target = candle(13, 140, 143, 139);
    expect(evaluateLongPlan(plan, [pending], false).status).toBe("pending");
    expect(evaluateLongPlan(plan, [pending, entry], false)).toMatchObject({ status: "open", entryPrice: 114 });
    expect(evaluateLongPlan(plan, [pending, entry, target], true)).toMatchObject({ status: "target", exitPrice: 142.36, resultR: 1.890667 });
  });

  it("fills an entry gap at open and marks same-candle exit as indeterminate", () => {
    expect(evaluateLongPlan(plan, [candle(11, 116, 118, 115)], false)).toMatchObject({ status: "open", entryPrice: 116 });
    expect(evaluateLongPlan(plan, [candle(11, 112, 145, 110)], false).status).toBe("indeterminate");
    expect(evaluateLongPlan(plan, [candle(11, 114, 145, 110)], false)).toMatchObject({ status: "target", exitPrice: 142.36 });
  });

  it("does not guess the order of stop and target on an open position", () => {
    const entry = candle(11, 112, 120, 111);
    expect(evaluateLongPlan(plan, [entry, candle(12, 120, 145, 98)], false).status).toBe("indeterminate");
  });

  it("recognizes a single intrabar stop after entry", () => {
    const entry = candle(11, 112, 120, 111);
    expect(evaluateLongPlan(plan, [entry, candle(12, 110, 112, 98)], false)).toMatchObject({ status: "stop", resultR: -1 });
  });

  it("fills stop and target exit gaps at open before intrabar extremes", () => {
    const entry = candle(11, 112, 120, 111);
    expect(evaluateLongPlan(plan, [entry, candle(12, 96, 145, 95)], false)).toMatchObject({ status: "stop", exitPrice: 96, resultR: -1.2 });
    expect(evaluateLongPlan(plan, [entry, candle(12, 146, 148, 98)], false)).toMatchObject({ status: "target", exitPrice: 146 });
  });

  it("expires without a fill on the final candle", () => {
    expect(evaluateLongPlan(plan, [candle(11, 110, 112, 109)], true).status).toBe("expired");
  });

  it("rejects pre-plan data and keeps an open position at scenario end", () => {
    expect(() => evaluateLongPlan(plan, [candle(10, 110, 112, 109)], false)).toThrow();
    expect(evaluateLongPlan(plan, [candle(11, 112, 120, 111)], true).status).toBe("open");
  });
});

describe("evaluation metadata and metrics", () => {
  it("hydrates an older evaluation without changing its result", () => {
    const old = { id: "5335747b-8713-4a8f-8f6f-5d72e3ca9eb8", planId: plan.id, evaluatedAt: "2026-09-27T00:00:00.000Z", observedThrough: 12, status: "target", entryPrice: 114, exitPrice: 142.36, resultR: 1.890667, reason: "Reached target" };
    const parsed = tradeEvaluationSchema.parse(old);
    expect(parsed.status).toBe("target");
    expect(parsed.schemaVersion).toBe("1");
    expect(parsed.evaluationMode).toBe("replay");
    expect(parsed.feedback).toEqual([]);
  });
  it("reports return and planned reward/risk separately", () => {
    expect(tradeMetrics(plan, 114, 142.36)).toEqual({ returnPercent: 24.877193, riskRewardRatio: 1.890667 });
    expect(tradeMetrics(plan, null, null).returnPercent).toBeNull();
  });
});
