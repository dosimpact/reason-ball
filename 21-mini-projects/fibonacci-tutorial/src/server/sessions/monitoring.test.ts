import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));
import { confirmPlan, createSession, evaluateLaterMarket, exportSession, getSession, replaySession, revisePlan } from "./service";
import { abortSessionMonitoring } from "./monitoring";
import { readSession, writeSession } from "./repository";

let directory: string;
const baseInput = { waveIndices: [0, 3, 6] as [number, number, number], entry: 120, stopLoss: 105, target: 140, rationale: "Wave 2 stays above Wave 0." };
beforeEach(async () => { directory = await mkdtemp(path.join(os.tmpdir(), "fib-monitor-")); process.env.FIBONACCI_DATA_DIR = directory; });
afterEach(async () => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.FIBONACCI_DATA_DIR; delete process.env.BINANCE_BASE_URL; await rm(directory, { recursive: true, force: true }); });

describe("server monitoring persistence", () => {
  it("auto-aborts at a separate invalidation level before the stop loss while leaving touch-v1 evaluation intact", async () => {
    const initial = await createSession("wave-three");
    const confirmed = await confirmPlan(initial.id, { ...baseInput, monitoring: { policy: "auto-abort", rule: { kind: "price-level", level: 109 } } });
    const record = (await readSession(initial.id))!;
    record.snapshot.candles[10] = { ...record.snapshot.candles[10], open: 120, high: 125, low: 108, close: 111 };
    await writeSession(record);
    await replaySession(initial.id, confirmed.cursor);
    const entered = await replaySession(initial.id, confirmed.cursor + 1);
    expect(entered.monitoring?.status).toBe("OPEN");
    const invalidated = await replaySession(initial.id, confirmed.cursor + 2);
    expect(invalidated.monitoring?.status).toBe("INVALIDATED_STOP");
    expect(invalidated.monitoring?.exitPrice).toBe(109);
    expect(invalidated.monitoring?.events.map((item) => item.kind)).toContain("INVALIDATED");
    expect(invalidated.evaluations.at(-1)?.status).toBe("open");
    expect(invalidated.evaluations.at(-1)?.monitoringSummary).toContain("INVALIDATED_STOP");
  });

  it("requires matching plan and cursor for pending/open abort and rejects repeated terminal abort", async () => {
    const first = await createSession("wave-three");
    let session = await confirmPlan(first.id, baseInput);
    const planId = session.plan!.id;
    await expect(abortSessionMonitoring(session.id, { expectedPlanId: planId, expectedCursor: 999, reason: "Stop" })).rejects.toMatchObject({ status: 409 });
    await expect(abortSessionMonitoring(session.id, { expectedPlanId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", expectedCursor: session.cursor, reason: "Stop" })).rejects.toMatchObject({ status: 409 });
    session = await abortSessionMonitoring(session.id, { expectedPlanId: planId, expectedCursor: session.cursor, reason: "Cancel pending." });
    expect(session.monitoring?.status).toBe("ABORTED");
    expect(session.monitoring?.exitPrice).toBeNull();
    expect(session.evaluations).toHaveLength(0);
    const pendingExport = await exportSession(session.id);
    if (!("monitoringAudit" in pendingExport) || !pendingExport.monitoringAudit) throw new Error("Missing monitor audit.");
    expect(pendingExport.monitoringAudit.events.at(-1)?.kind).toBe("ABORTED");
    await expect(abortSessionMonitoring(session.id, { expectedPlanId: planId, expectedCursor: session.cursor, reason: "Duplicate" })).rejects.toMatchObject({ status: 409 });

    const openInitial = await createSession("wave-three");
    session = await confirmPlan(openInitial.id, baseInput);
    await replaySession(session.id, session.cursor);
    session = await replaySession(session.id, session.cursor + 1);
    expect(session.monitoring?.status).toBe("OPEN");
    session = await abortSessionMonitoring(session.id, { expectedPlanId: session.plan!.id, expectedCursor: session.cursor, reason: "Manual risk review." });
    expect(session.monitoring?.status).toBe("ABORTED");
    expect(session.monitoring?.exitPrice).toBe(session.visibleCandles.at(-1)?.close);
  });

  it("appends an abort summary after a final OPEN evaluation without rewriting the prior evaluation", async () => {
    const initial = await createSession("wave-three");
    let session = await confirmPlan(initial.id, { ...baseInput, target: 200 });
    while (!session.complete) session = await replaySession(session.id, session.cursor);
    expect(session.monitoring?.status).toBe("OPEN");
    const previous = session.evaluations.at(-1)!;
    const previousCount = session.evaluations.length;
    session = await abortSessionMonitoring(session.id, { expectedPlanId: session.plan!.id, expectedCursor: session.cursor, reason: "Exit after final observation." });
    expect(session.evaluations).toHaveLength(previousCount + 1);
    expect(session.evaluations[previousCount - 1]).toEqual(previous);
    expect(session.evaluations.at(-1)?.status).toBe(previous.status);
    expect(session.evaluations.at(-1)?.monitoringSummary).toContain("ABORTED");
    expect(session.evaluations.at(-1)?.feedback.find((item) => item.rule === "strategy-monitor")?.reason).toContain("ABORTED");
    expect((await getSession(session.id)).evaluations.at(-1)?.monitoringSummary).toContain("ABORTED");
  });

  it("restores a legacy confirmed plan on GET without modifying its JSON file", async () => {
    const initial = await createSession("wave-three");
    const confirmed = await confirmPlan(initial.id, baseInput);
    const file = path.join(directory, `${initial.id}.json`);
    const raw = JSON.parse(await readFile(file, "utf8"));
    delete raw.view.monitoring;
    delete raw.view.monitoringHistory;
    delete raw.view.plan.monitoringConfig;
    delete raw.view.plans[0].monitoringConfig;
    await writeFile(file, JSON.stringify(raw));
    const before = await readFile(file, "utf8");
    const restored = await getSession(initial.id);
    expect(restored.monitoring?.planId).toBe(confirmed.plan?.id);
    expect(restored.monitoring?.events[0].kind).toBe("PLAN_LOADED");
    expect((await getSession(initial.id)).monitoring).toEqual(restored.monitoring);
    expect(await readFile(file, "utf8")).toBe(before);
    const exported = await exportSession(initial.id);
    expect(exported.schemas).toHaveProperty("monitoringState");
    expect(exported.schemas).toHaveProperty("monitoringEvent");
  });

  it("preserves old execution events when a plan is revised", async () => {
    const initial = await createSession("market-lab");
    const first = await confirmPlan(initial.id, baseInput);
    await revisePlan(first.id, first.plan!.id);
    const second = await confirmPlan(first.id, baseInput);
    expect(second.monitoringHistory).toHaveLength(2);
    expect(second.monitoringHistory[0].planId).toBe(first.plan?.id);
    expect(second.monitoringHistory[1].planId).toBe(second.plan?.id);
  });

  it("rejects a Wave 3 index from the future and derives overlap from the public Wave 1 high", async () => {
    const initial = await createSession("wave-three");
    await expect(confirmPlan(initial.id, { ...baseInput, monitoring: { policy: "auto-abort", rule: { kind: "wave4-overlap", wave3Index: 9 } } })).rejects.toMatchObject({ status: 400 });
    const record = (await readSession(initial.id))!;
    record.view.cursor = 10;
    record.view.visibleCandles = record.snapshot.candles.slice(0, 11);
    await writeSession(record);
    const confirmed = await confirmPlan(initial.id, { ...baseInput, monitoring: { policy: "auto-abort", rule: { kind: "wave4-overlap", wave3Index: 9 } } });
    expect(confirmed.plan?.monitoringConfig?.rule).toMatchObject({ kind: "wave4-overlap", level: 120, wave3Index: 9, wave3Time: record.snapshot.candles[9].time });
  });

  it("accepts a new price rule below the latest close even if that prior candle touched it intrabar", async () => {
    const initial = await createSession("wave-three");
    const confirmed = await confirmPlan(initial.id, { ...baseInput, monitoring: { policy: "auto-abort", rule: { kind: "price-level", level: 111.5 } } });
    expect(confirmed.monitoring?.rule).toEqual({ kind: "price-level", level: 111.5 });
    expect(confirmed.visibleCandles.at(-1)?.low).toBeLessThanOrEqual(111.5);
    expect(confirmed.visibleCandles.at(-1)?.close).toBeGreaterThan(111.5);
  });

  it("deduplicates monitoring events when the same Binance closed bars are evaluated again", async () => {
    const hour = 3_600_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(200 * hour);
    process.env.BINANCE_BASE_URL = "http://monitor-binance.test";
    const rows = Array.from({ length: 120 }, (_, index) => {
      const openMs = (80 + index) * hour;
      const open = index === 0 ? 102 : index === 3 ? 116 : index === 6 ? 112 : 115;
      const high = index === 3 ? 120 : index === 6 ? 114 : 119;
      const low = index === 0 ? 100 : index === 3 ? 115 : index === 6 ? 110 : 111;
      const close = index === 0 ? 102 : index === 6 ? 112 : 115;
      return [openMs, String(open), String(high), String(low), String(close), "10", openMs + hour - 1, "0", 1, "0", "0", "0"];
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const start = Number(url.searchParams.get("startTime"));
      const end = Number(url.searchParams.get("endTime"));
      const limit = Number(url.searchParams.get("limit"));
      return Response.json(rows.filter((row) => Number(row[0]) >= start && Number(row[0]) <= end).slice(0, limit));
    }));
    const initial = await createSession("market-lab", { type: "binance", symbol: "BTCUSDT", interval: "1h" });
    await confirmPlan(initial.id, baseInput);
    const first = await evaluateLaterMarket(initial.id);
    const second = await evaluateLaterMarket(initial.id);
    expect(second.monitoring?.events).toEqual(first.monitoring?.events);
    expect(second.monitoring?.observedThrough).toBe(first.monitoring?.observedThrough);
    expect(second.evaluations).toHaveLength(first.evaluations.length + 1);
  });
});
