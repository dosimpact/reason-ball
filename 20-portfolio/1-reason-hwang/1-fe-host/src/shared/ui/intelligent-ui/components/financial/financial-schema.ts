import { z } from "zod/v4";

const barSchema = z.object({
  time: z.string(), open: z.number(), high: z.number(), low: z.number(), close: z.number(), volume: z.number(),
  sma: z.number().nullable().optional(), rsi: z.number().nullable().optional(),
  macd: z.number().nullable().optional(), signal: z.number().nullable().optional(), histogram: z.number().nullable().optional(),
});
const metadata = {
  symbol: z.string().optional(), interval: z.string().optional(), currency: z.string().optional(),
  source: z.string().optional(), source_url: z.string().optional(), as_of: z.string().optional(), fetched_at: z.string().optional(),
  auto_adjust: z.boolean().optional(), warnings: z.array(z.string()).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(), bars: z.array(barSchema),
  error: z.string().optional(), status: z.string().optional(),
};
export const indicatorSeriesSchema = z.object({
  key: z.string(), label: z.string(), unit: z.string(), display: z.enum(["line", "histogram", "markers"]),
  role: z.enum(["upper", "middle", "lower"]).optional(), bandGroup: z.string().optional(),
  values: z.array(z.number().nullable()),
});
export const indicatorInstanceSchema = z.object({
  instanceId: z.string(), name: z.string(), label: z.string(), parameters: z.record(z.string(), z.unknown()),
  panel: z.enum(["price", "oscillator"]), status: z.enum(["success", "error"]), error: z.string().nullable().optional(), errorCode: z.string().nullable().optional(),
  signal: z.object({ state: z.string(), cross: z.string().optional() }).passthrough().optional(),
  warnings: z.array(z.string()).optional(), series: z.array(indicatorSeriesSchema),
});
export const financialSnapshotV2Schema = z.object({
  ...metadata, schemaVersion: z.literal(2), catalogVersion: z.string(), indicators: z.array(indicatorInstanceSchema),
  origin: z.object({ date: z.string().nullable(), availableHistory: z.number(), policy: z.string() }).passthrough().optional(),
});
const legacySnapshotSchema = z.object({ ...metadata, schemaVersion: z.literal(1).optional(), indicators: z.array(z.string()).optional() });
export const financialSnapshotSchema = z.union([financialSnapshotV2Schema, legacySnapshotSchema]);
export const indicatorCatalogSchema = z.object({
  schemaVersion: z.literal(2), catalogVersion: z.string(), maxInstances: z.number(), maxVisiblePanels: z.number(),
  defaultInstances: z.array(z.object({ name: z.string(), parameters: z.record(z.string(), z.number()).optional(), showSignal: z.boolean().optional() })),
  indicators: z.array(z.object({
    name: z.string(), label: z.string(), defaults: z.record(z.string(), z.number()),
    parameters: z.record(z.string(), z.object({ default: z.number(), min: z.number(), max: z.number(), type: z.enum(["integer", "number"]) })),
    supportsSignal: z.boolean(), panel: z.enum(["price", "oscillator"]),
    series: z.array(indicatorSeriesSchema.omit({ values: true })),
  })),
});
export type FinancialSnapshot = z.infer<typeof financialSnapshotSchema>;
export type IndicatorInstance = z.infer<typeof indicatorInstanceSchema>;
export type IndicatorCatalog = z.infer<typeof indicatorCatalogSchema>;
