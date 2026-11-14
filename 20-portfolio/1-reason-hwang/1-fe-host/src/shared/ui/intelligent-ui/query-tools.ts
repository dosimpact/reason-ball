import { withBase } from "./base-path";
import { financialSnapshotSchema } from "./financial-schema";

const allowedArguments = new Set(["ticker", "interval", "count", "indicators", "sma_period", "rsi_period", "macd_fast", "macd_slow", "macd_signal"]);

export async function fetchTechnicalAnalysisChart(args: Record<string, unknown>, signal?: AbortSignal) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (!allowedArguments.has(key) || !["string", "number"].includes(typeof value)) throw new Error(`Invalid chart argument: ${key}`);
    query.set(key, String(value));
  }
  const response = await fetch(withBase(`/api/langgraph/technical-analysis/chart?${query}`), { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`가격 조회 실패 (${response.status})`);
  return financialSnapshotSchema.parse(await response.json());
}
