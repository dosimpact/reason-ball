import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
vi.mock("server-only", () => ({}));
import { waveThreeCandles } from "@/entities/tutorial/content/units/wave-three";
import { advanceSession, confirmPlan, createSession, evaluateLaterMarket, getSession, revisePlan, replaySession } from "./service";
import { readSession } from "./repository";

let dataDir: string;
beforeEach(async () => { dataDir = await mkdtemp(path.join(os.tmpdir(), "fibonacci-server-test-")); process.env.FIBONACCI_DATA_DIR = dataDir; });
afterEach(async () => { vi.unstubAllGlobals(); delete process.env.FIBONACCI_DATA_DIR; delete process.env.BINANCE_BASE_URL; await rm(dataDir, { recursive: true, force: true }); });

const planInput = { waveIndices: [0, 3, 6] as [number, number, number], entry: 120, stopLoss: 105, target: 140, rationale: "Wave 2 remains above Wave 0." };

it("reads a legacy session and supplies the new public defaults without changing its immutable snapshot", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const planId = "22222222-2222-4222-8222-222222222222";
  const snapshot = { source: "dummy", id: "sha256:legacy", candles: waveThreeCandles };
  const plan = {
    schemaVersion: "1", id: planId, sessionId: id, unitId: "wave-three", createdAt: new Date(0).toISOString(), asOf: waveThreeCandles[7].time,
    snapshotId: snapshot.id, source: "dummy", wavePoints: [
      { wave: 0, candleIndex: 0, time: waveThreeCandles[0].time, price: 100 },
      { wave: 1, candleIndex: 3, time: waveThreeCandles[3].time, price: 120 },
      { wave: 2, candleIndex: 6, time: waveThreeCandles[6].time, price: 110 },
    ], entry: 120, stopLoss: 105, target: 140, rationale: "legacy", fibonacci: { retracement: 0.5, extension1618: 142.36 }, policyVersion: "touch-v1",
  };
  const evaluation = { id: "33333333-3333-4333-8333-333333333333", planId, evaluatedAt: new Date(0).toISOString(), observedThrough: waveThreeCandles[8].time, status: "pending", entryPrice: null, exitPrice: null, resultR: null, reason: "legacy" };
  await writeFile(path.join(dataDir, `${id}.json`), JSON.stringify({ view: { id, unitId: "wave-three", cursor: 8, visibleCandles: waveThreeCandles.slice(0, 9), totalCandles: 12, plan, evaluations: [evaluation], complete: false }, snapshot }));
  const view = await getSession(id);
  expect(view.source).toEqual({ type: "dummy" });
  expect(view.unit?.task).toBe("trade");
  expect(view.plans).toHaveLength(1);
  expect(view.plan?.revision).toBe(1);
  expect(view.evaluations[0].evaluationMode).toBe("replay");
  expect((await readSession(id))?.snapshot).toEqual(snapshot);
  expect((await replaySession(id, 8)).cursor).toBe(9);
});

describe("revision after later-market evaluation", () => {
  it("freezes a new decision-time snapshot and keeps a no-new-bars evaluation pending", async () => {
    const hour = 3_600_000;
    const start = hour;
    const bars = Array.from({ length: 130 }, (_, i) => {
      const openMs = start + i * hour;
      const open = i === 0 ? 102 : i === 3 ? 116 : i === 6 ? 112 : 115;
      const high = i === 3 ? 120 : i === 6 ? 114 : 119;
      const low = i === 0 ? 100 : i === 3 ? 115 : i === 6 ? 110 : 111;
      return [openMs, String(open), String(high), String(low), i === 6 ? "112" : "115", "10", openMs + hour - 1, "0", 1, "0", "0", "0"];
    });
    process.env.BINANCE_BASE_URL = "http://session-binance.test";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const from = Number(url.searchParams.get("startTime"));
      const to = Number(url.searchParams.get("endTime"));
      const limit = Number(url.searchParams.get("limit"));
      return Response.json(bars.filter((bar) => Number(bar[0]) >= from && Number(bar[0]) <= to).slice(0, limit));
    }));
    vi.spyOn(Date, "now").mockReturnValue(200 * hour);
    try {
      const initial = await createSession("market-lab", { type: "binance", symbol: "BTCUSDT", interval: "1h", startTime: start });
      expect(initial.visibleCandles).toHaveLength(80);
      const first = await confirmPlan(initial.id, planInput);
      const observed = await evaluateLaterMarket(initial.id);
      expect(observed.complete).toBe(true);
      expect(observed.visibleCandles).toHaveLength(130);
      const revisionDraft = await revisePlan(initial.id, first.plan!.id);
      expect(revisionDraft.complete).toBe(false);
      const second = await confirmPlan(initial.id, planInput);
      expect(second.plan?.previousPlanId).toBe(first.plan?.id);
      expect(second.plan?.revision).toBe(2);
      expect(second.plan?.snapshotId).not.toBe(first.plan?.snapshotId);
      expect(second.plan?.asOf).toBe(observed.visibleCandles.at(-1)?.time);
      const pending = await evaluateLaterMarket(initial.id);
      expect(pending.evaluations.at(-1)?.status).toBe("pending");
      expect(pending.evaluations.at(-1)?.reason).toContain("No new closed market candles");
      expect(pending.complete).toBe(false);
      expect((await readSession(initial.id))?.planSnapshots?.[first.plan!.id]).toHaveLength(80);
      expect((await readSession(initial.id))?.planSnapshots?.[second.plan!.id]).toHaveLength(130);
    } finally { vi.restoreAllMocks(); }
  });
});


it("theory Prev restores the whole step, guards bounds/stale requests, and reopens completed lessons", async () => {
  const first = await createSession("impulse-theory");
  await expect(advanceSession(first.id, 0, "prev")).rejects.toMatchObject({ status: 409 });
  await advanceSession(first.id, 0);
  await expect(advanceSession(first.id, 0, "prev")).rejects.toMatchObject({ status: 409 });
  const back = await advanceSession(first.id, 1, "prev");
  expect(back.instruction).toEqual(first.instruction);
  expect(back.visibleCandles).toEqual(first.visibleCandles);
  expect(back.selectedIndices).toEqual(first.selectedIndices);
  expect(back.cursor).toBe(first.cursor);
  expect((await getSession(first.id)).theoryStep).toBe(0);
  for (let i = 0; i < 4; i++) await advanceSession(first.id, i);
  expect((await getSession(first.id)).complete).toBe(true);
  const review = await advanceSession(first.id, 3, "prev");
  expect(review.theoryStep).toBe(2);
  expect(review.complete).toBe(false);
  expect((await advanceSession(first.id, 2)).theoryStep).toBe(3);
  const practice = await createSession("wave-three");
  await expect(advanceSession(practice.id, 0, "prev")).rejects.toMatchObject({ status: 409 });
});
