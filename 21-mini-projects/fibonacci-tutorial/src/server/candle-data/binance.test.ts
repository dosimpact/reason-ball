import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getBinanceCandles, getLaterBinanceCandles, MarketDataError, normalizeKlines } from "./binance";

const source = { type: "binance" as const, symbol: "BTCUSDT" as const, interval: "1h" as const };
const hour = 3_600_000;
function row(openMs: number, low = "99") { return [openMs, "100", "110", low, "105", "12.5", openMs + hour - 1, "0", 1, "0", "0", "0"]; }
afterEach(() => { vi.unstubAllGlobals(); delete process.env.BINANCE_BASE_URL; });

describe("Binance closed-bar adapter", () => {
  it("normalizes OHLC and excludes an unfinished bar", () => {
    expect(normalizeKlines([row(hour), row(2 * hour)], { startTime: hour, endTime: 3 * hour - 1, duration: hour, now: 2 * hour + 30_000 }))
      .toEqual([{ time: 3600, open: 100, high: 110, low: 99, close: 105, volume: 12.5 }]);
  });
  it("caches an identical range and protects cached values from mutation", async () => {
    process.env.BINANCE_BASE_URL = "http://local-binance.test";
    const fetcher = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () => Response.json([row(hour)]));
    vi.stubGlobal("fetch", fetcher);
    const options = { startTime: hour, endTime: 2 * hour - 1, limit: 2, now: 3 * hour };
    const first = await getBinanceCandles(source, options);
    first[0].close = 1;
    expect((await getBinanceCandles(source, options))[0].close).toBe(105);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/v3/klines");
  });
  it("rejects duplicates and never caches a failed request", async () => {
    process.env.BINANCE_BASE_URL = "http://local-binance.test";
    const fetcher = vi.fn(async () => Response.json([row(7 * hour), row(7 * hour)]));
    vi.stubGlobal("fetch", fetcher);
    const options = { startTime: 7 * hour, endTime: 9 * hour - 1, limit: 2, now: 10 * hour };
    await expect(getBinanceCandles(source, options)).rejects.toBeInstanceOf(MarketDataError);
    await expect(getBinanceCandles(source, options)).rejects.toBeInstanceOf(MarketDataError);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("maps rate limits to an upstream error", async () => {
    process.env.BINANCE_BASE_URL = "http://local-binance.test";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
    await expect(getBinanceCandles(source, { startTime: 11 * hour, endTime: 12 * hour - 1, now: 20 * hour }))
      .rejects.toMatchObject({ status: 503, message: "Binance market data returned HTTP 429." });
  });
  it("rejects an evaluation range over 4000 bars before any upstream call", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(getLaterBinanceCandles(source, 3600, 5000 * hour)).rejects.toMatchObject({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
