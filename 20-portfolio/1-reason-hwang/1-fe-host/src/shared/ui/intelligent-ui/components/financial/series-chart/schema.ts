import { z } from "zod/v4";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates").refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a valid calendar date");
const finite = z.number().finite();
const whitespace = z.strictObject({ time: date });
const scalar = z.strictObject({ time: date, value: finite });
const candle = z.strictObject({ time: date, open: finite, high: finite, low: finite, close: finite }).refine(
  point => point.high >= Math.max(point.open, point.close, point.low) && point.low <= Math.min(point.open, point.close),
  "OHLC high/low must contain open and close",
);
export const financialSeriesSchema = z.object({
  id: z.string().min(1), title: z.string().optional(),
  type: z.enum(["candlestick", "line", "area", "baseline", "histogram"]),
  priceScaleId: z.enum(["left", "right"]).optional(), color: z.string().optional(), baseValue: finite.optional(),
  data: z.array(z.union([candle, scalar, whitespace])),
  markers: z.array(z.object({ time: date, position: z.enum(["aboveBar", "belowBar", "inBar"]), shape: z.enum(["circle", "square", "arrowUp", "arrowDown"]), color: z.string(), text: z.string().optional() })).optional(),
  priceLines: z.array(z.object({ price: finite, color: z.string(), title: z.string().optional(), lineStyle: z.enum(["solid", "dashed", "dotted"]).optional() })).optional(),
}).superRefine((series, context) => {
  series.data.forEach((point, index) => {
    if (index > 0 && point.time <= series.data[index - 1].time) context.addIssue({ code: "custom", path: ["data", index, "time"], message: "Dates must be sorted and unique" });
    if (("open" in point && series.type !== "candlestick") || ("value" in point && series.type === "candlestick")) context.addIssue({ code: "custom", path: ["data", index], message: `Data must match ${series.type}: use OHLC for candlestick and value for scalar series` });
  });
  const dates = new Set(series.data.filter(point => "open" in point || "value" in point).map(point => point.time));
  series.markers?.forEach((marker, index, markers) => {
    if (!dates.has(marker.time)) context.addIssue({ code: "custom", path: ["markers", index, "time"], message: "Markers must reference a non-whitespace data date" });
    if (index > 0 && marker.time < markers[index - 1].time) context.addIssue({ code: "custom", path: ["markers", index, "time"], message: "Markers must be sorted by date" });
  });
});
export const financialSeriesChartSchema = z.object({
  title: z.string().optional(), height: z.number().int().min(160).max(1200).optional(), series: z.array(financialSeriesSchema),
}).superRefine((config, context) => {
  const ids = new Set<string>();
  config.series.forEach((series, index) => {
    if (ids.has(series.id)) context.addIssue({ code: "custom", path: ["series", index, "id"], message: "Series IDs must be unique" });
    ids.add(series.id);
  });
});
export type FinancialSeriesChartConfig = z.infer<typeof financialSeriesChartSchema>;
export type FinancialSeries = z.infer<typeof financialSeriesSchema>;
