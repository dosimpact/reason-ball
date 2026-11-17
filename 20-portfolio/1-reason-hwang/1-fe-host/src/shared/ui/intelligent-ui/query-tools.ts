import { withBase } from "./base-path";
import { financialSnapshotSchema, indicatorCatalogSchema } from "./components/financial/financial-schema";

const allowedArguments = new Set(["ticker", "interval", "count", "indicators", "sma_period", "rsi_period", "macd_fast", "macd_slow", "macd_signal", "schema_version", "instances"]);

/** Bounds headers AND body parsing; a stalled body must not leave Query pending. */
export async function withQueryDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal, timeoutMs = 30_000): Promise<T> {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason ?? new DOMException("Aborted", "AbortError"));
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("조회 응답이 30초 안에 완료되지 않았습니다. 다시 시도하세요.")), timeoutMs);
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  try { return await Promise.race([operation(controller.signal), aborted]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", rejectAbort);
  }
}

export async function fetchTechnicalAnalysisChart(args: Record<string, unknown>, signal?: AbortSignal, endpoint = "/api/langgraph/technical-analysis/chart") {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (!allowedArguments.has(key) || !["string", "number"].includes(typeof value)) throw new Error(`Invalid chart argument: ${key}`);
    query.set(key, String(value));
  }
  return withQueryDeadline(async boundedSignal => {
    const response = await fetch(withBase(`${endpoint}?${query}`), { signal: boundedSignal, cache: "no-store" });
    if (!response.ok) throw new Error(`가격 조회 실패 (${response.status})`);
    const snapshot = financialSnapshotSchema.parse(await response.json());
    if (snapshot.schemaVersion === 2 && snapshot.indicators.some(indicator => indicator.series.some(series => series.values.length !== snapshot.bars.length))) throw new Error("지표와 가격 데이터의 시간축이 일치하지 않습니다.");
    return snapshot;
  }, signal);
}


export async function fetchIndicatorCatalog(endpoint: string, signal?: AbortSignal) {
  return withQueryDeadline(async boundedSignal => {
    const response = await fetch(withBase(endpoint), { signal: boundedSignal, cache: "no-store" });
    if (!response.ok) throw new Error(`지표 목록 조회 실패 (${response.status})`);
    return indicatorCatalogSchema.parse(await response.json());
  }, signal);
}
