import "server-only";
import { candleSchema, isValidCandle, type Candle } from "@/entities/candle";

export type BinanceSource = { type: "binance"; symbol: "BTCUSDT" | "ETHUSDT"; interval: "1h" | "4h" | "1d"; startTime?: number };

export class MarketDataError extends Error {
  constructor(public readonly status: 502 | 503, message: string) { super(message); }
}

const intervalMs = { "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 } as const;
const cache = new Map<string, { expires: number; candles: Candle[] }>();
const MAX_BARS = 1000;

export function binanceIntervalMs(interval: BinanceSource["interval"]): number { return intervalMs[interval]; }

export async function getBinanceCandles(source: BinanceSource, options: { startTime?: number; endTime?: number; limit?: number; now?: number } = {}): Promise<Candle[]> {
  const now = options.now ?? Date.now();
  const duration = intervalMs[source.interval];
  const limit = options.limit ?? 120;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BARS) throw new Error("Binance limit must be between 1 and 1000.");
  const newestClosedOpen = Math.floor(now / duration) * duration - duration;
  const startTime = options.startTime ?? source.startTime ?? Math.max(0, newestClosedOpen - (limit - 1) * duration);
  const endTime = Math.min(options.endTime ?? newestClosedOpen + duration - 1, newestClosedOpen + duration - 1);
  if (!Number.isSafeInteger(startTime) || startTime < 0 || startTime > endTime) throw new Error("No closed candles exist in the requested range.");
  const base = process.env.BINANCE_BASE_URL ?? "https://data-api.binance.vision";
  const url = new URL("/api/v3/klines", base);
  url.searchParams.set("symbol", source.symbol);
  url.searchParams.set("interval", source.interval);
  url.searchParams.set("startTime", String(startTime));
  url.searchParams.set("endTime", String(endTime));
  url.searchParams.set("limit", String(limit));
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.candles.map((bar) => ({ ...bar }));
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch (error) {
    throw new MarketDataError(503, `Binance market data unavailable: ${error instanceof Error ? error.message : "network failure"}`);
  }
  if (!response.ok) throw new MarketDataError(response.status === 429 ? 503 : 502, `Binance market data returned HTTP ${response.status}.`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new MarketDataError(502, "Binance returned invalid JSON."); }
  const candles = normalizeKlines(payload, { startTime, endTime, duration, now });
  const historical = endTime < Math.floor(now / duration) * duration - duration;
  cache.set(key, { expires: now + (historical ? 86_400_000 : 30_000), candles });
  return candles.map((bar) => ({ ...bar }));
}

export function normalizeKlines(payload: unknown, bounds: { startTime: number; endTime: number; duration: number; now: number }): Candle[] {
  if (!Array.isArray(payload)) throw new MarketDataError(502, "Binance returned invalid klines.");
  const candles: Candle[] = [];
  let previousOpen = -1;
  for (const row of payload) {
    if (!Array.isArray(row) || row.length !== 12) throw new MarketDataError(502, "Binance returned an incomplete kline.");
    const openMs = Number(row[0]);
    const closeMs = Number(row[6]);
    const volume = Number(row[5]);
    const raw = { time: openMs / 1000, open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume };
    if (!Number.isSafeInteger(openMs) || !Number.isSafeInteger(closeMs) || closeMs !== openMs + bounds.duration - 1 || openMs <= previousOpen || openMs < bounds.startTime || openMs > bounds.endTime || !Number.isFinite(volume) || volume < 0) {
      throw new MarketDataError(502, "Binance returned unordered, duplicate, or out-of-range klines.");
    }
    previousOpen = openMs;
    if (closeMs >= bounds.now) continue;
    const candle = candleSchema.safeParse(raw);
    if (!candle.success || !isValidCandle(candle.data)) throw new MarketDataError(502, "Binance returned invalid OHLC data.");
    candles.push(candle.data);
  }
  return candles;
}

/** Query at most four pages after the plan's bar. The returned bars are closed at now. */
export async function getLaterBinanceCandles(source: BinanceSource, afterSeconds: number, now = Date.now()): Promise<Candle[]> {
  const duration = intervalMs[source.interval];
  const end = Math.floor(now / duration) * duration - 1;
  let start = afterSeconds * 1000 + duration;
  if (start <= end && Math.floor((end - start) / duration) + 1 > 4 * MAX_BARS) {
    throw new MarketDataError(503, "Later-market range exceeds the 4000-candle evaluation limit.");
  }
  const collected: Candle[] = [];
  for (let page = 0; page < 4 && start <= end; page += 1) {
    const bars = await getBinanceCandles(source, { startTime: start, endTime: end, limit: MAX_BARS, now });
    if (bars.length === 0) break;
    collected.push(...bars);
    start = bars[bars.length - 1].time * 1000 + duration;
    if (bars.length < MAX_BARS) break;
  }
  if (start <= end && collected.length >= 4 * MAX_BARS) throw new MarketDataError(503, "Later-market range exceeds the 4000-candle evaluation limit.");
  return collected;
}
