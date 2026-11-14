import { z } from "zod/v4";

const barSchema = z.object({
  time: z.string(), open: z.number(), high: z.number(), low: z.number(), close: z.number(), volume: z.number(),
  sma: z.number().nullable().optional(), rsi: z.number().nullable().optional(),
  macd: z.number().nullable().optional(), signal: z.number().nullable().optional(), histogram: z.number().nullable().optional(),
});
export const financialSnapshotSchema = z.object({
  symbol: z.string().optional(), interval: z.string().optional(), currency: z.string().optional(),
  source: z.string().optional(), source_url: z.string().optional(), as_of: z.string().optional(), fetched_at: z.string().optional(),
  auto_adjust: z.boolean().optional(), warnings: z.array(z.string()).optional(), indicators: z.array(z.string()).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(), bars: z.array(barSchema),
  error: z.string().optional(), status: z.string().optional(),
});
export type FinancialSnapshot = z.infer<typeof financialSnapshotSchema>;
