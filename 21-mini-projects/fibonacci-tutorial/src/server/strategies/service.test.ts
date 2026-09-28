import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));
import { advanceBacktest, confirmStrategy, controlStrategyRun, createStrategy, exportStrategy, getStrategyView, listStrategyViews, pollForward, reviseStrategy, startStrategyRun, updateStrategyDraft } from "./service";
import { strategyRunSchema, strategyViewSchema } from "@/entities/strategy";
import { listDummyCutoffs } from "./data";

let directory: string;
beforeEach(async () => { directory = await mkdtemp(path.join(os.tmpdir(), "fib-strategy-")); process.env.FIBONACCI_DATA_DIR = directory; });
afterEach(async () => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.BINANCE_BASE_URL; delete process.env.FIBONACCI_DATA_DIR; await rm(directory, { recursive: true, force: true }); });
const confirm = (expectedVersion: number, target = 200) => ({
  expectedVersion, waveIndices: [0, 3, 7] as [number, number, number], entry: 114, stopLoss: 99, target,
  rationale: "Wave 2 held above Wave 0.", monitoring: { policy: "auto-abort" as const, rule: { kind: "price-level" as const, level: 105 } },
});

describe("independent strategy persistence and execution", () => {
  it("publishes selectable dummy cutoff times and available horizon without future OHLC", () => {
    const options = listDummyCutoffs();
    expect(options.dummyCutoffs[0]).toEqual({ index: 4, ordinal: 5, asOf: 1_700_000_000 + 4 * 3600, maxBacktestBars: 7 });
    expect(options.dummyCutoffs.at(-1)).toMatchObject({ index: 10, ordinal: 11, maxBacktestBars: 1 });
    expect(JSON.stringify(options)).not.toMatch(/"(?:open|high|low|close|candles)"/);
  });
  it("persists a partial draft without exposing future OHLC before confirmation", async () => {
    let view = await createStrategy({ title: "Wave 3 plan", mode: "BACKTEST", source: { type: "dummy" } });
    expect(view.visibleCandles).toHaveLength(8);
    expect(view.status).toBe("DRAFT");
    expect(view).not.toHaveProperty("unitId");
    view = await updateStrategyDraft(view.id, { expectedVersion: view.version, draftPlan: {
      waveIndices: [0, 3], entry: null, rationale: "Still writing", decisionReasons: { wave: "" },
    } });
    expect((await getStrategyView(view.id)).draftPlan.waveIndices).toEqual([0, 3]);
    const exported = await exportStrategy(view.id) as {strategy:{visibleCandles:unknown[];runs:unknown[]};schemas:object};
    expect(exported.strategy.visibleCandles).toHaveLength(8);
    expect(exported.strategy.runs).toHaveLength(0);
    expect(exported.schemas).toHaveProperty("strategyPlan");
    expect((await listStrategyViews()).strategies[0].id).toBe(view.id);
    await expect(updateStrategyDraft(view.id, { expectedVersion: 1, title: "Stale" })).rejects.toMatchObject({ status: 409 });
  });

  it("gives backtest step and batch identical monitoring outcomes and leaves an open position open at horizon", async () => {
    let view = await createStrategy({ title: "Replay", mode: "BACKTEST", source: { type: "dummy" } });
    view = await confirmStrategy(view.id, confirm(view.version));
    expect(view.plan?.fibonacci).toBeDefined();
    const planId = view.plan!.id;
    view = await startStrategyRun(view.id, { expectedVersion: view.version, mode: "BACKTEST" });
    const firstRunId = view.activeRunId!;
    const beforeStep = await exportStrategy(view.id) as {strategy:unknown;runAudits:Array<{visibleCandles:unknown[]}>};
    expect(strategyViewSchema.parse(beforeStep.strategy)).toBeDefined();
    expect(beforeStep.runAudits[0].visibleCandles).toHaveLength(8);
    while (view.runs.at(-1)!.controlStatus !== "COMPLETED") {
      view = await advanceBacktest(view.id, firstRunId, { expectedVersion: view.version }, false);
    }
    const first = view.runs.at(-1)!;
    expect(first.observedCount).toBe(4);
    expect(first.monitoring.status).toBe("OPEN");
    expect(first.evaluation.unrealizedPnl).not.toBeNull();
    expect(view.visibleCandles).toHaveLength(12);
    view = await startStrategyRun(view.id, { expectedVersion: view.version, mode: "BACKTEST" });
    view = await advanceBacktest(view.id, view.activeRunId!, { expectedVersion: view.version }, true);
    const second = view.runs.at(-1)!;
    expect(strategyRunSchema.parse(second)).toBeDefined();
    expect({ ...second.monitoring, events: second.monitoring.events.map((event) => ({ ...event, recordedAt: "" })) })
      .toEqual({ ...first.monitoring, events: first.monitoring.events.map((event) => ({ ...event, recordedAt: "" })) });
    expect(second.evaluation).toEqual(first.evaluation);
    expect(second.observedSnapshotId).toBe(first.observedSnapshotId);
    expect(second.planId).toBe(planId);
    const exported = await exportStrategy(view.id) as {runAudits:Array<{events:Array<{runEventId:string}>;visibleCandles:unknown[]}>};
    expect(exported.runAudits[0].events[0].runEventId).not.toBe(exported.runAudits[1].events[0].runEventId);
    expect(exported.runAudits[0].visibleCandles).toHaveLength(12);
  });

  it("keeps old runs when revising to a forward dummy simulation, and pause is not liquidation", async () => {
    let view = await createStrategy({ title: "Revision", mode: "BACKTEST", source: { type: "dummy" } });
    view = await confirmStrategy(view.id, confirm(view.version));
    const oldPlan = view.plan!.id;
    view = await startStrategyRun(view.id, { expectedVersion: view.version, mode: "BACKTEST" });
    view = await reviseStrategy(view.id, { expectedVersion: view.version, mode: "FORWARD" });
    expect(view.status).toBe("DRAFT");
    expect(view.plans[0].id).toBe(oldPlan);
    expect(view.runs).toHaveLength(1);
    view = await confirmStrategy(view.id, confirm(view.version));
    expect(view.plan!.previousPlanId).toBe(oldPlan);
    view = await startStrategyRun(view.id, { expectedVersion: view.version, mode: "FORWARD" });
    const runId = view.activeRunId!;
    view = await controlStrategyRun(view.id, runId, "pause", { expectedVersion: view.version });
    expect(view.runs.at(-1)!.monitoring.status).toBe("PENDING");
    await expect(pollForward(view.id, runId, { expectedVersion: view.version })).rejects.toMatchObject({ status: 409 });
    view = await controlStrategyRun(view.id, runId, "resume", { expectedVersion: view.version });
    view = await pollForward(view.id, runId, { expectedVersion: view.version });
    expect(view.runs.at(-1)!.observedCount).toBe(1);
    view = await controlStrategyRun(view.id, runId, "abort", { expectedVersion: view.version, reason: "Manual review" });
    expect(view.runs.at(-1)!.monitoring.status).toBe("ABORTED");
    expect(view.runs[0].planId).toBe(oldPlan);
  });

  it("expires an unfilled backtest at the horizon but stops a filled target run at its terminal candle", async () => {
    let pending = await createStrategy({ title: "No fill", mode: "BACKTEST", source: { type: "dummy" } });
    pending = await confirmStrategy(pending.id, { ...confirm(pending.version, 250), entry: 200 });
    pending = await startStrategyRun(pending.id, { expectedVersion: pending.version, mode: "BACKTEST" });
    pending = await advanceBacktest(pending.id, pending.activeRunId!, { expectedVersion: pending.version }, true);
    expect(pending.runs[0].monitoring.status).toBe("EXPIRED");
    expect(pending.runs[0].observedCount).toBe(4);
    expect(pending.runs[0].evaluation.entryPrice).toBeNull();

    let target = await createStrategy({ title: "Early target", mode: "BACKTEST", source: { type: "dummy" } });
    target = await confirmStrategy(target.id, confirm(target.version, 135));
    target = await startStrategyRun(target.id, { expectedVersion: target.version, mode: "BACKTEST" });
    target = await advanceBacktest(target.id, target.activeRunId!, { expectedVersion: target.version }, true);
    expect(target.runs[0].monitoring.status).toBe("CLOSED_TP");
    expect(target.runs[0].observedCount).toBeLessThan(4);
    expect(target.visibleCandles).toHaveLength(target.runs[0].cursor + 1);
  });

  it("rejects a dummy backtest horizon beyond available closed candles", async () => {
    await expect(createStrategy({ title: "Too long", mode: "BACKTEST", source: { type: "dummy" }, backtestBars: 5 }))
      .rejects.toMatchObject({ status: 400, code: "DATA_SELECTION_ERROR" });
  });

  it("restores an earlier saved run missing newer audit fields without rewriting the JSON on GET", async () => {
    let view = await createStrategy({ title: "Saved", mode: "BACKTEST", source: { type: "dummy" } });
    view = await confirmStrategy(view.id, confirm(view.version));
    view = await startStrategyRun(view.id, { expectedVersion: view.version, mode: "BACKTEST" });
    const file = path.join(directory, "strategies", `${view.id}.json`);
    const raw = JSON.parse(await readFile(file, "utf8"));
    delete raw.view.runs[0].lastError;
    delete raw.view.runs[0].observedSnapshotId;
    delete raw.view.runs[0].dataRange;
    await writeFile(file, JSON.stringify(raw));
    const before = await readFile(file, "utf8");
    const restored = await getStrategyView(view.id);
    expect(restored.runs[0].lastError).toBeNull();
    expect(restored.runs[0].observedSnapshotId).toMatch(/^sha256:/);
    expect(restored.runs[0].dataRange.startTime).toBe(view.asOf);
    expect(await readFile(file, "utf8")).toBe(before);
  });

  it("rejects a stale Binance forward draft, refreshes its public baseline, and only polls new contiguous closed bars", async () => {
    const hour = 3_600_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(200.5 * hour);
    process.env.BINANCE_BASE_URL = "http://standalone-binance-stale.test";
    let omittedOpen = -1;
    const rows = Array.from({ length: 140 }, (_, index) => {
      const hourIndex = 70 + index;
      const openMs = hourIndex * hour;
      const high = hourIndex === 83 || hourIndex === 84 ? 120 : 119;
      const low = hourIndex === 80 || hourIndex === 81 ? 100 : hourIndex === 87 || hourIndex === 88 ? 110 : 111;
      return [openMs, "115", String(high), String(low), "115", "10", openMs + hour - 1, "0", 1, "0", "0", "0"];
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const start = Number(url.searchParams.get("startTime"));
      const end = Number(url.searchParams.get("endTime"));
      const limit = Number(url.searchParams.get("limit"));
      return Response.json(rows.filter((row) => Number(row[0]) >= start && Number(row[0]) <= end && Number(row[0]) !== omittedOpen * hour).slice(0, limit));
    }));
    const source = { type: "binance" as const, symbol: "BTCUSDT" as const, interval: "1h" as const };
    let view = await createStrategy({ title: "Live", mode: "FORWARD", source });
    expect(view.asOf).toBe(199 * 3600);
    expect(view.visibleCandles.at(-1)?.time).toBe(view.asOf);
    vi.setSystemTime(201.5 * hour);
    await expect(confirmStrategy(view.id, { ...confirm(view.version, 150), entry: 125 })).rejects.toMatchObject({ status: 409, code: "STALE_MARKET_DRAFT" });
    view = await updateStrategyDraft(view.id, { expectedVersion: view.version, refreshData: true });
    expect(view.asOf).toBe(200 * 3600);
    expect(view.draftPlan).toEqual({});
    view = await confirmStrategy(view.id, { ...confirm(view.version, 150), entry: 125 });
    view = await startStrategyRun(view.id, { expectedVersion: view.version, mode: "FORWARD" });
    const runId = view.activeRunId!;
    const initialEvents = view.runs.at(-1)!.monitoring.events;
    view = await pollForward(view.id, runId, { expectedVersion: view.version });
    expect(view.runs.at(-1)!.controlStatus).toBe("WAITING");
    expect(view.runs.at(-1)!.observedCount).toBe(0);
    expect(view.runs.at(-1)!.monitoring.events).toEqual(initialEvents);
    vi.setSystemTime(203.5 * hour);
    view = await pollForward(view.id, runId, { expectedVersion: view.version });
    expect(view.runs.at(-1)!.observedCount).toBe(2);
    expect(view.runs.at(-1)!.controlStatus).toBe("RUNNING");
    expect(view.runs.at(-1)!.monitoring.observedThrough).toBe(202 * 3600);
    const before = view.runs.at(-1)!.monitoring.events;
    view = await pollForward(view.id, runId, { expectedVersion: view.version });
    expect(view.runs.at(-1)!.observedCount).toBe(2);
    expect(view.runs.at(-1)!.controlStatus).toBe("WAITING");
    expect(view.runs.at(-1)!.monitoring.events).toEqual(before);
    vi.setSystemTime(204.5 * hour);
    omittedOpen = 203;
    await expect(pollForward(view.id, runId, { expectedVersion: view.version })).rejects.toMatchObject({ status: 502 });
    view = await getStrategyView(view.id);
    expect(view.runs.at(-1)!.observedCount).toBe(2);
    expect(view.runs.at(-1)!.controlStatus).toBe("ERROR");
    expect(view.runs.at(-1)!.lastError?.code).toBe("UPSTREAM_ERROR");
    view = await controlStrategyRun(view.id, runId, "resume", { expectedVersion: view.version });
    expect(view.runs.at(-1)!.lastError).toBeNull();
    vi.setSystemTime(4206.5 * hour);
    await expect(pollForward(view.id, runId, { expectedVersion: view.version })).rejects.toMatchObject({ status: 503 });
    view = await getStrategyView(view.id);
    expect(view.runs.at(-1)!.observedCount).toBe(2);
    expect(view.runs.at(-1)!.controlStatus).toBe("ERROR");
  });
});
