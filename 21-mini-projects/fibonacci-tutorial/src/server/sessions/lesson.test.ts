import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));
import { advanceSession, createSession, getSession } from "./service";
import { selectLessonCase, submitLesson } from "./lesson";
import { confirmAnalysisPlan, reflectAnalysis, replayAnalysis, reviseAnalysisPlan } from "./analysis";

let directory: string;
beforeEach(async () => { directory = await mkdtemp(path.join(os.tmpdir(), "fib-lesson-")); process.env.FIBONACCI_DATA_DIR = directory; });
afterEach(async () => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.FIBONACCI_DATA_DIR; delete process.env.BINANCE_BASE_URL; await rm(directory, { recursive: true, force: true }); });

function planFor(session: Awaited<ReturnType<typeof createSession>>) {
  return { primary: { pattern: "uncertain", direction: "uncertain" as const, degree: "candidate", segments: [], evidence: "The visible split is ambiguous.", invalidation: "Recheck after a new closed bar." },
    abstainReason: "The visible candles do not establish a unique pattern.", rules: "No objective rule may be broken.",
    guidelines: "Ratios guide but do not prove the count.", anchors: "Visible swing high and low.", nextObservation: "Observe a closed candle.",
    asOf: session.learning!.asOf!, snapshotId: session.learning!.snapshotId! };
}

describe("advanced lesson server", () => {
  it("only sends the current theory stage and requires a 2-of-3 quiz after stage five", async () => {
    let session = await createSession("ew-fib-anchors");
    expect(session.learning?.steps).toHaveLength(1);
    expect(session.visibleCandles).toHaveLength(12);
    expect(JSON.stringify(session)).not.toContain("correctAnswers");
    for (let step = 0; step < 4; step += 1) session = await advanceSession(session.id, step);
    expect(session.visibleCandles).toHaveLength(60);
    await expect(advanceSession(session.id, 4)).rejects.toMatchObject({ status: 409 });
    session = await submitLesson(session.id, { answers: { q1: 1, q2: 1, q3: 0 } });
    expect(session.complete).toBe(false);
    session = await submitLesson(session.id, { answers: { q1: 1, q2: 0, q3: 2 } });
    expect(session.complete).toBe(true);
    expect((await getSession(session.id)).complete).toBe(true);
  });

  it("does not reveal assessment data or allow skipping earlier cases", async () => {
    const session = await createSession("ew-bearish-impulse");
    expect(session.visibleCandles).toHaveLength(96);
    expect(JSON.stringify(session)).not.toContain("expected");
    await expect(selectLessonCase(session.id, 2)).rejects.toMatchObject({ status: 409 });
    const failed = await submitLesson(session.id, { caseId: "ew-bearish-impulse-basic-v1", values: { points: [0, 1, 2, 3, 4, 96], ruleEvidence: "Rule evidence." } });
    expect(failed.complete).toBe(false);
    expect(failed.learning?.feedback.join(" ")).toContain("공개된 봉");
  });

  it("loads historical H data without fetching a live market or exposing the 40 later candles", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const session = await createSession("ew-blind-analysis");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(session.visibleCandles).toHaveLength(80);
      expect(session.totalCandles).toBe(120);
      expect(session.source).toMatchObject({ type: "binance", symbol: "BTCUSDT", interval: "1h" });
      expect(session.learning?.snapshotId).toMatch(/^sha256:/);
    } finally { fetchSpy.mockRestore(); }
  });

  it("freezes an analysis revision before replay and rejects stale or cross-case reflection", async () => {
    const initial = await createSession("ew-blind-analysis");
    const plan = planFor(initial);
    const confirmed = await confirmAnalysisPlan(initial.id, plan);
    const planId = confirmed.analysis!.activePlanId!;
    await expect(replayAnalysis(initial.id, initial.cursor - 1)).rejects.toMatchObject({ status: 409 });
    const observed = await replayAnalysis(initial.id, initial.cursor);
    expect(observed.visibleCandles).toHaveLength(81);
    expect(observed.analysis?.plans[0].plan).toEqual(plan);
    await expect(reflectAnalysis(initial.id, randomId(), "Other case")).rejects.toMatchObject({ status: 409 });
    const reflected = await reflectAnalysis(initial.id, planId, "The next bar does not resolve the ambiguity.");
    expect(reflected.analysis?.reflections).toHaveLength(1);
    const revisionDraft = await reviseAnalysisPlan(initial.id, planId);
    expect(revisionDraft.analysis?.plans).toHaveLength(1);
    const newPlan = { ...plan, asOf: revisionDraft.learning!.asOf!, snapshotId: revisionDraft.learning!.snapshotId! };
    const revised = await confirmAnalysisPlan(initial.id, newPlan);
    expect(revised.analysis?.plans[1].previousPlanId).toBe(planId);
    expect(revised.analysis?.plans[1].revision).toBe(2);
  });

  it("aligns M's visible resolutions at the same closed UTC boundary", async () => {
    const session = await createSession("ew-aligned-count");
    expect(session.visibleCandles).toHaveLength(240);
    expect(session.learning?.timeframes?.["1h"]).toHaveLength(240);
    expect(session.learning?.timeframes?.["4h"]).toHaveLength(60);
    expect(session.learning?.timeframes?.["1d"]).toHaveLength(10);
    const asOf = session.learning!.asOf!;
    expect(session.learning!.timeframes!["1d"].at(-1)!.time + 86400).toBe(asOf + 3600);
    const plan = planFor(session);
    const invalid = await submitLesson(session.id, { caseId: session.learning!.currentCase!.id, values: { parent: [0, 10], children: [0, 23], analysis: plan }, rubric: [2, 2, 2, 1, 1] });
    expect(invalid.learning?.objectivePassed).toBe(false);
    expect(invalid.learning?.feedback.join(" ")).toContain("multiscale-range");
    const valid = await submitLesson(session.id, { caseId: session.learning!.currentCase!.id, values: { parent: [0, 1], children: [0, 23], analysis: plan }, rubric: [2, 2, 2, 1, 1] });
    expect(valid.learning?.objectivePassed).toBe(true);
  });

  it("opens the three portfolio regions independently while preserving different frozen datasets", async () => {
    const first = await createSession("ew-final-portfolio");
    const second = await selectLessonCase(first.id, 1);
    const third = await selectLessonCase(first.id, 2);
    expect(first.source).toMatchObject({ symbol: "BTCUSDT", interval: "1h" });
    expect(second.source).toMatchObject({ symbol: "ETHUSDT", interval: "1h" });
    expect(third.source).toMatchObject({ symbol: "BTCUSDT", interval: "4h" });
    expect(new Set([first.learning?.currentCase?.sourceNote, second.learning?.currentCase?.sourceNote, third.learning?.currentCase?.sourceNote]).size).toBe(3);
  });

  it("completes the portfolio only after all three distinct frozen cases have plans, observations, and reflections", async () => {
    let session = await createSession("ew-final-portfolio");
    for (let caseIndex = 0; caseIndex < 3; caseIndex += 1) {
      if (caseIndex > 0) session = await selectLessonCase(session.id, caseIndex);
      const plan = planFor(session);
      session = await confirmAnalysisPlan(session.id, plan);
      const activeId = session.analysis!.activePlanId!;
      session = await replayAnalysis(session.id, session.cursor);
      session = await reflectAnalysis(session.id, activeId, `Case ${caseIndex}: the new closed bar preserves uncertainty.`);
      session = await submitLesson(session.id, { caseId: session.learning!.currentCase!.id, values: { analysis: plan }, rubric: [2, 2, 2, 1, 1] });
      expect(session.learning?.objectivePassed).toBe(true);
      expect(session.complete).toBe(caseIndex === 2);
    }
    expect(new Set(session.analysis!.plans.map((item) => item.plan.snapshotId)).size).toBe(3);
    expect(session.analysis?.evaluations).toHaveLength(3);
    expect(session.analysis?.reflections).toHaveLength(3);
  });

  it("ignores a forged L observedAt until a new candle closes after plan confirmation", async () => {
    const hour = 3_600_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(200 * hour);
    process.env.BINANCE_BASE_URL = "http://lesson-binance.test";
    const rows = Array.from({ length: 121 }, (_, index) => {
      const openMs = (80 + index) * hour;
      return [openMs, "100", "101", "99", "100", "10", openMs + hour - 1, "0", 1, "0", "0", "0"];
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const start = Number(url.searchParams.get("startTime"));
      const end = Number(url.searchParams.get("endTime"));
      const limit = Number(url.searchParams.get("limit"));
      return Response.json(rows.filter((row) => Number(row[0]) >= start && Number(row[0]) <= end).slice(0, limit));
    }));
    let session = await createSession("ew-live-followup");
    const plan = planFor(session);
    session = await confirmAnalysisPlan(session.id, plan);
    session = await submitLesson(session.id, { caseId: session.learning!.currentCase!.id, values: { analysis: plan }, rubric: [2, 2, 2, 1, 1], observedAt: 9999999999 });
    expect(session.learning?.objectivePassed).toBe(false);
    expect(session.complete).toBe(false);
    await expect(import("./analysis").then(({ evaluateLaterAnalysis }) => evaluateLaterAnalysis(session.id))).rejects.toMatchObject({ status: 409 });
    vi.setSystemTime(201 * hour + 1);
    const { evaluateLaterAnalysis } = await import("./analysis");
    session = await evaluateLaterAnalysis(session.id);
    expect(session.analysis?.evaluations.at(-1)?.mode).toBe("later-market");
    session = await submitLesson(session.id, { caseId: session.learning!.currentCase!.id, values: { analysis: plan }, rubric: [2, 2, 2, 1, 1] });
    expect(session.learning?.objectivePassed).toBe(true);
  });
});

function randomId(): string { return "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; }
