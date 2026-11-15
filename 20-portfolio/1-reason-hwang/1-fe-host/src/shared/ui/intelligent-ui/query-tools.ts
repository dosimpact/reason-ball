import { withBase } from "./base-path";
import { financialSnapshotSchema, indicatorCatalogSchema } from "./financial-schema";

const allowedArguments = new Set(["ticker", "interval", "count", "indicators", "sma_period", "rsi_period", "macd_fast", "macd_slow", "macd_signal", "schema_version", "instances"]);

export async function fetchTechnicalAnalysisChart(args: Record<string, unknown>, signal?: AbortSignal, endpoint = "/api/langgraph/technical-analysis/chart") {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (!allowedArguments.has(key) || !["string", "number"].includes(typeof value)) throw new Error(`Invalid chart argument: ${key}`);
    query.set(key, String(value));
  }
  const response = await fetch(withBase(`${endpoint}?${query}`), { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`가격 조회 실패 (${response.status})`);
  const snapshot = financialSnapshotSchema.parse(await response.json());
  if (snapshot.schemaVersion === 2 && snapshot.indicators.some(indicator => indicator.series.some(series => series.values.length !== snapshot.bars.length))) throw new Error("지표와 가격 데이터의 시간축이 일치하지 않습니다.");
  return snapshot;
}


export async function fetchIndicatorCatalog(endpoint: string, signal?: AbortSignal) {
  const response = await fetch(withBase(endpoint), { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`지표 목록 조회 실패 (${response.status})`);
  return indicatorCatalogSchema.parse(await response.json());
}
