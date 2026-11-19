import type { CanvasRequest } from "./canvas";

/** Only a successfully resolved Query may supply arguments to explicit reanalysis. */
export function analysisRequestFromQuery(args: Record<string, unknown>, fallbackIndicators?: unknown[]): CanvasRequest {
  const ticker = typeof args.ticker === "string" ? args.ticker.trim() : "";
  const interval = args.interval;
  const count = Number(args.count);
  if (!ticker || !["1d", "1wk"].includes(String(interval)) || !Number.isInteger(count) || count < 2 || count > 200) throw new Error("성공한 조회의 티커·주기·봉 수를 확인하세요.");
  let indicators: unknown[] | undefined = fallbackIndicators;
  if (Number(args.schema_version) === 2 && typeof args.instances === "string") {
    const parsed: unknown = JSON.parse(args.instances);
    if (!Array.isArray(parsed)) throw new Error("지표 인스턴스는 배열이어야 합니다.");
    indicators = parsed;
  } else if (typeof args.indicators === "string") {
    indicators = args.indicators.split(",").map(name => name.trim()).filter(Boolean).map(name => name === "RSI" ? { name, timeperiod: Number(args.rsi_period ?? 14) } : name === "SMA" ? { name, timeperiod: Number(args.sma_period ?? 20) } : { name, fastperiod: Number(args.macd_fast ?? 12), slowperiod: Number(args.macd_slow ?? 26), signalperiod: Number(args.macd_signal ?? 9) });
  }
  return { ticker, interval: interval as "1d" | "1wk", count, ...(indicators ? { indicators } : {}) };
}
