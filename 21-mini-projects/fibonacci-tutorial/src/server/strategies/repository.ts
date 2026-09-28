import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { candleSchema } from "@/entities/candle";
import { strategyViewSchema, type StrategyView } from "@/entities/strategy";
import type { StrategySnapshot } from "./data";
import { snapshotDigest } from "./data";

const snapshotSchema = z.strictObject({
  id: z.string().min(1), candles: z.array(candleSchema).min(1), initialCursor: z.number().int().nonnegative(),
  source: strategyViewSchema.shape.source, dataset: strategyViewSchema.shape.dataset,
});
const recordSchema = z.strictObject({
  view: strategyViewSchema, snapshots: z.record(z.string(), snapshotSchema),
  runCandles: z.record(z.string(), z.array(candleSchema)),
});
export interface StrategyRecord {
  view: StrategyView;
  snapshots: Record<string, StrategySnapshot>;
  runCandles: Record<string, StrategyView["visibleCandles"]>;
}

let pendingMutation: Promise<unknown> = Promise.resolve();
export function serializeStrategyMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const result = pendingMutation.then(mutation, mutation);
  pendingMutation = result.catch(() => undefined);
  return result;
}

function directory(): string {
  return path.join(path.resolve(process.env.FIBONACCI_DATA_DIR ?? path.join(process.cwd(), ".data")), "strategies");
}
function recordPath(id: string): string { return path.join(directory(), `${id}.json`); }
function isMissing(error: unknown): boolean { return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT"; }

export async function readStrategy(id: string): Promise<StrategyRecord | null> {
  if (!z.uuid().safeParse(id).success) return null;
  try {
    const raw = JSON.parse(await readFile(recordPath(id), "utf8")) as unknown;
    if (raw && typeof raw === "object" && "view" in raw && "runCandles" in raw) {
      const candidate = raw as {view?:{runs?:Array<Record<string,unknown>>};runCandles?:Record<string,unknown>};
      for (const run of candidate.view?.runs ?? []) {
        if (!("lastError" in run)) run.lastError = null;
        if (!("dataRange" in run) && typeof run.id === "string" && typeof run.cursor === "number") {
          const candles = candidate.runCandles?.[run.id];
          if (Array.isArray(candles) && candles.length > 0) {
            const first = run.monitoring && typeof run.monitoring === "object" && "events" in run.monitoring && Array.isArray(run.monitoring.events)
              ? (run.monitoring.events[0] as {candleTime?:number})?.candleTime : undefined;
            run.dataRange = { startTime: first ?? (candles[0] as {time:number}).time,
              endTime: run.mode === "BACKTEST" ? (candles.at(-1) as {time:number}).time : (candles[run.cursor] as {time:number}).time };
          }
        }
        if (!("observedSnapshotId" in run) && typeof run.id === "string" && run.source && typeof run.cursor === "number") {
          const candles = candidate.runCandles?.[run.id];
          if (Array.isArray(candles)) run.observedSnapshotId = snapshotDigest(run.source as StrategyView["source"], candles.slice(0, run.cursor + 1));
        }
      }
    }
    return recordSchema.parse(raw);
  }
  catch (error) { if (isMissing(error)) return null; throw error; }
}

export async function listStrategies(): Promise<StrategyRecord[]> {
  let files: string[];
  try { files = await readdir(directory()); } catch (error) { if (isMissing(error)) return []; throw error; }
  const records = await Promise.all(files.filter((file) => /^[0-9a-f-]{36}\.json$/i.test(file)).map((file) => readStrategy(file.slice(0, -5))));
  return records.filter((record): record is StrategyRecord => record !== null);
}

export async function writeStrategy(record: StrategyRecord): Promise<void> {
  const valid = recordSchema.parse(record);
  await mkdir(directory(), { recursive: true });
  const temp = path.join(directory(), `${valid.view.id}.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, JSON.stringify(valid), { flag: "wx" });
    await rename(temp, recordPath(valid.view.id));
  } catch (error) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}
