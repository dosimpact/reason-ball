import type { FinancialSnapshot, IndicatorInstance } from "./financial-schema";

/** Compatibility adapter only; all numeric values remain server-owned. */
export function chartIndicators(snapshot: FinancialSnapshot): IndicatorInstance[] {
  if (snapshot.schemaVersion === 2) return snapshot.indicators;
  const bars = snapshot.bars;
  const selected = (name: string, key: "sma" | "rsi" | "macd") => snapshot.indicators?.includes(name) || bars.some(bar => typeof bar[key] === "number");
  const series = (key: "sma" | "rsi" | "macd" | "signal" | "histogram", label: string, unit: string, display: "line" | "histogram" = "line") => ({ key, label, unit, display, values: bars.map(bar => bar[key] ?? null) });
  const indicators: IndicatorInstance[] = [];
  if (selected("SMA", "sma")) indicators.push({ instanceId: "legacy-sma", name: "SMA", label: `SMA(${snapshot.parameters?.sma_period ?? 20})`, panel: "price", parameters: { timeperiod: snapshot.parameters?.sma_period ?? 20 }, status: "success", series: [series("sma", "SMA", snapshot.currency ?? "price")] });
  if (selected("RSI", "rsi")) indicators.push({ instanceId: "legacy-rsi", name: "RSI", label: `RSI(${snapshot.parameters?.rsi_period ?? 14})`, panel: "oscillator", parameters: { timeperiod: snapshot.parameters?.rsi_period ?? 14 }, status: "success", series: [series("rsi", "RSI", "0–100")] });
  if (selected("MACD", "macd")) indicators.push({ instanceId: "legacy-macd", name: "MACD", label: `MACD(${snapshot.parameters?.macd_fast ?? 12}/${snapshot.parameters?.macd_slow ?? 26}/${snapshot.parameters?.macd_signal ?? 9})`, panel: "oscillator", parameters: snapshot.parameters ?? {}, status: "success", series: [series("macd", "MACD", "price"), series("signal", "Signal", "price"), series("histogram", "Histogram", "price", "histogram")] });
  return indicators;
}
