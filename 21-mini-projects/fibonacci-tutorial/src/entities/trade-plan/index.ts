import { z } from "zod";
import { fibonacciSchema } from "@/entities/fibonacci/@x";
import { wavePointSchema, validationResultSchema } from "@/entities/wave/@x";
import { monitoringInputSchema, monitoringConfigSchema } from "@/entities/strategy-monitor/@x";

export const decisionReasonsSchema = z.strictObject({
  wave: z.string().trim().min(1), fibonacci: z.string().trim().min(1),
  entry: z.string().trim().min(1), stopLoss: z.string().trim().min(1),
  target: z.string().trim().min(1), invalidation: z.string().trim().min(1),
  exit: z.string().trim().min(1),
});
export type DecisionReasons = z.infer<typeof decisionReasonsSchema>;
export const sourceConfigSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("dummy") }),
  z.strictObject({ type: z.literal("binance"), symbol: z.enum(["BTCUSDT", "ETHUSDT"]), interval: z.enum(["1h", "4h", "1d"]), startTime: z.number().int().nonnegative().optional() }),
]);
export type SourceConfig = z.infer<typeof sourceConfigSchema>;

export const confirmPlanInputSchema = z.strictObject({
  waveIndices: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().nonnegative()]),
  entry: z.number().finite().positive(), stopLoss: z.number().finite().positive(), target: z.number().finite().positive(),
  rationale: z.string().trim().min(1).max(2000),
  decisionReasons: decisionReasonsSchema.optional(),
  exitStrategy: z.string().trim().min(1).max(2000).optional(),
  monitoring: monitoringInputSchema.optional(),
});
export type ConfirmPlanInput = z.infer<typeof confirmPlanInputSchema>;
export const confirmPlanInputJsonSchema = z.toJSONSchema(confirmPlanInputSchema);

export const tradePlanSchema = z.strictObject({
  schemaVersion: z.literal("1"), id: z.uuid(), sessionId: z.uuid(), unitId: z.string().min(1),
  createdAt: z.iso.datetime(), asOf: z.number().int().nonnegative(), snapshotId: z.string().min(1),
  source: z.enum(["dummy", "binance"]),
  wavePoints: z.tuple([wavePointSchema, wavePointSchema, wavePointSchema]),
  entry: z.number().finite().positive(), stopLoss: z.number().finite().positive(), target: z.number().finite().positive(),
  rationale: z.string().min(1), fibonacci: fibonacciSchema, policyVersion: z.literal("touch-v1"),
  revision: z.number().int().positive().default(1), previousPlanId: z.uuid().nullable().default(null),
  scenarioId: z.string().default("wave-three"), sourceConfig: sourceConfigSchema.default({ type: "dummy" }),
  invalidationPrice: z.number().finite().positive().nullable().default(null),
  decisions: decisionReasonsSchema.optional(), exitStrategy: z.string().default("Review the position after Wave 5 and consider correction risk."),
  validation: z.array(validationResultSchema).default([]),
  monitoringConfig: monitoringConfigSchema.nullable().default(null),
});
export type TradePlan = z.infer<typeof tradePlanSchema>;
export const tradePlanJsonSchema = z.toJSONSchema(tradePlanSchema);

export function validateLongPrices(input: Pick<ConfirmPlanInput, "entry" | "stopLoss" | "target">): void {
  if (!(input.stopLoss < input.entry && input.entry < input.target)) throw new Error("Long plan requires stopLoss < entry < target.");
}
