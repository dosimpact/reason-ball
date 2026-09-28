import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { candleSchema, isValidCandle, type Candle } from "@/entities/candle";

interface HistoricalFixtureEntry {
  id: string;
  file: string;
  source: "binance";
  symbol: "BTCUSDT" | "ETHUSDT";
  interval: "1h" | "4h" | "1d";
  startTime: number;
  endTime: number;
  count: number;
  sha256: string;
  capturedAt: string;
  url: string;
  review: string;
}

export interface HistoricalFixture {
  manifest: HistoricalFixtureEntry;
  candles: Candle[];
  snapshotId: string;
}

const intervals = { "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 } as const;

function fixtureDirectory(): string {
  return path.join(process.cwd(), "src", "server", "candle-data", "fixtures");
}

export async function loadHistoricalFixture(id: string): Promise<HistoricalFixture> {
  const directory = fixtureDirectory();
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")) as unknown;
  if (!Array.isArray(manifest)) throw new Error("Historical fixture manifest is invalid.");
  const entry = manifest.find((item): item is HistoricalFixtureEntry => !!item && typeof item === "object" && "id" in item && item.id === id);
  if (!entry || !/^[a-z0-9-]+\.json$/.test(entry.file)) throw new Error(`Historical fixture ${id} is unavailable.`);
  const raw = await readFile(path.join(directory, entry.file));
  const digest = createHash("sha256").update(raw).digest("hex");
  if (digest !== entry.sha256.replace(/^sha256:/, "")) throw new Error(`Historical fixture ${id} hash mismatch.`);
  const parsed = JSON.parse(raw.toString("utf8")) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== entry.count) throw new Error(`Historical fixture ${id} bar count mismatch.`);
  const candles = parsed.map((value, index) => {
    const result = candleSchema.safeParse(value);
    if (!result.success || !isValidCandle(result.data)) throw new Error(`Historical fixture ${id} contains invalid OHLC at ${index}.`);
    return result.data;
  });
  const duration = intervals[entry.interval];
  if (candles[0].time * 1000 !== entry.startTime || candles.at(-1)!.time * 1000 + duration - 1 !== entry.endTime) {
    throw new Error(`Historical fixture ${id} UTC bounds mismatch.`);
  }
  for (let index = 1; index < candles.length; index += 1) {
    if ((candles[index].time - candles[index - 1].time) * 1000 !== duration) throw new Error(`Historical fixture ${id} has a missing or duplicate bar.`);
  }
  return { manifest: entry, candles, snapshotId: `sha256:${digest}` };
}
