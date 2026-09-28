import "server-only";
import { randomUUID } from "node:crypto";
import { validateAnalysisPlan, type AnalysisPlan, type AnalysisState } from "@/entities/lesson";
import { getLessonCase, getLessonDefinition } from "@/entities/lesson/server";
import type { SessionView } from "@/entities/tutorial";
import { getLaterBinanceCandles, MarketDataError } from "@/server/candle-data/binance";
import { readSession, serializeMutation, writeSession, type SessionRecord } from "./repository";
import { SessionError } from "./service";
import { lessonView, visibleSnapshotId } from "./lesson";

function caseId(session: SessionView): string {
  const id = getLessonCase(session.unitId, session.learning?.caseIndex ?? 0)?.id;
  if (!id) throw new SessionError(409, "CONFLICT", "No active analysis case.");
  return id;
}

function analysisState(session: SessionView): AnalysisState {
  if (!session.analysis || !session.learning) throw new SessionError(409, "CONFLICT", "This unit has no analysis plan.");
  return session.analysis;
}

function currentPlan(session: SessionView) {
  const state = analysisState(session);
  const active = state.plans.find((item) => item.id === state.activePlanId);
  if (!active || active.caseId !== caseId(session)) throw new SessionError(409, "CONFLICT", "Confirm a plan for the current case first.");
  return active;
}

function verifyFrozenPlan(record: SessionRecord, plan: ReturnType<typeof currentPlan>): void {
  const planCursor = record.snapshot.candles.findIndex((bar) => bar.time === plan.plan.asOf);
  if (planCursor < 0) throw new SessionError(409, "CONFLICT", "Plan asOf is absent from this frozen case.");
  const original = lessonView(record.view.unitId, record.view.learning!.caseIndex, 0, record.snapshot, planCursor);
  if (original.snapshotId !== plan.plan.snapshotId) throw new SessionError(409, "CONFLICT", "Frozen case does not match the immutable plan snapshot.");
}

function checkPlanBoundary(session: SessionView, input: AnalysisPlan): void {
  const expectedAsOf = session.visibleCandles.at(-1)?.time;
  const expectedDigest = visibleSnapshotId(session.visibleCandles, session.learning?.timeframes);
  if (input.asOf !== expectedAsOf || input.snapshotId !== expectedDigest) throw new SessionError(409, "CONFLICT", "Plan asOf or snapshotId does not match the currently visible candles.");
  const failedStructure = validateAnalysisPlan(input, session.cursor + 1).filter((item) => !item.pass);
  if (failedStructure.length) throw new SessionError(400, "VALIDATION_ERROR", failedStructure.map((item) => `${item.rule}: ${item.reason}`).join(" "));
  if (!input.alternate && !input.abstainReason) throw new SessionError(400, "VALIDATION_ERROR", "Record an alternate hypothesis or an abstention reason.");
  if (input.optionalTrade) {
    const { entry, stop, target } = input.optionalTrade;
    const direction = input.primary.direction;
    if ((direction === "up" && !(stop < entry && entry < target)) || (direction === "down" && !(target < entry && entry < stop)) || (direction !== "up" && direction !== "down")) {
      throw new SessionError(400, "VALIDATION_ERROR", "Optional trade prices must match the declared direction.");
    }
  }
}

function advancedComplete(record: SessionRecord, analysis: AnalysisState): boolean {
  const definition = getLessonDefinition(record.view.unitId);
  if (!definition?.cases?.every((item) => record.lessonProgress?.[item.id]?.grade.passed)) return false;
  if (!["D60R", "D96R", "H", "HR", "M", "L"].includes(definition.profile)) return true;
  const requiredCases = definition.cases;
  if (definition.id === "ew-final-portfolio") {
    const snapshots = requiredCases.map((item) => record.lessonSnapshots?.[item.id]?.id);
    if (snapshots.some((item) => !item) || new Set(snapshots).size < 3) return false;
  }
  return requiredCases.every((item) => {
    const plans = analysis.plans.filter((plan) => plan.caseId === item.id);
    return plans.some((plan) => analysis.evaluations.some((evaluation) => evaluation.planId === plan.id && evaluation.caseId === item.id && evaluation.observedThrough > plan.plan.asOf)
      && (analysis.reflections?.some((reflection) => reflection.planId === plan.id && reflection.caseId === item.id) ?? analysis.reflection?.planId === plan.id));
  });
}

export function confirmAnalysisPlan(id: string, input: AnalysisPlan): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const session = record.view;
    const state = analysisState(session);
    if (state.activePlanId) throw new SessionError(409, "CONFLICT", "Revise the active analysis before confirming another plan.");
    checkPlanBoundary(session, input);
    const currentCaseId = caseId(session);
    const previous = state.plans.filter((item) => item.caseId === currentCaseId).at(-1);
    const revision = { schemaVersion: "2" as const, id: randomUUID(), caseId: currentCaseId, revision: (previous?.revision ?? 0) + 1,
      previousPlanId: previous?.id ?? null, createdAt: new Date().toISOString(), plan: input };
    const updated: SessionView = { ...session, analysis: { ...state, plans: [...state.plans, revision], activePlanId: revision.id } };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}

export function reviseAnalysisPlan(id: string, expectedPlanId: string): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const session = record.view;
    const state = analysisState(session);
    if (state.activePlanId !== expectedPlanId || !state.plans.some((item) => item.id === expectedPlanId && item.caseId === caseId(session))) throw new SessionError(409, "CONFLICT", "Active analysis plan is stale.");
    const updated: SessionView = { ...session, analysis: { ...state, activePlanId: null }, complete: false };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}

export function replayAnalysis(id: string, expectedCursor: number): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const session = record.view;
    const plan = currentPlan(session);
    verifyFrozenPlan(record, plan);
    if (expectedCursor !== session.cursor) throw new SessionError(409, "CONFLICT", "Replay cursor is stale.");
    if (session.cursor >= record.snapshot.candles.length - 1) throw new SessionError(409, "CONFLICT", "No frozen replay candles remain.");
    const cursor = session.cursor + 1;
    const visibleCandles = record.snapshot.candles.slice(0, cursor + 1);
    const learning = lessonView(session.unitId, session.learning!.caseIndex, 0, record.snapshot, cursor, session.learning!.feedback, session.learning!.objectivePassed, session.learning!.submitted);
    const observation = `Observed one new closed candle after analysis asOf ${plan.plan.asOf}.`;
    const evaluation = { id: randomUUID(), planId: plan.id, caseId: plan.caseId, mode: "replay" as const, observedFrom: plan.plan.asOf,
      observedThrough: visibleCandles.at(-1)!.time, createdAt: new Date().toISOString(), objectiveFeedback: [observation], observation };
    const analysis = { ...session.analysis!, evaluations: [...session.analysis!.evaluations, evaluation] };
    const updated: SessionView = { ...session, cursor, visibleCandles, learning, analysis, complete: advancedComplete(record, analysis) };
    await writeSession({ ...record, view: updated, lessonCursors: { ...record.lessonCursors, [plan.caseId]: cursor } });
    return updated;
  });
}

export function evaluateLaterAnalysis(id: string): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const session = record.view;
    const plan = currentPlan(session);
    verifyFrozenPlan(record, plan);
    const lessonCase = getLessonCase(session.unitId, session.learning!.caseIndex);
    if (lessonCase?.profile !== "L" || session.source.type !== "binance") throw new SessionError(409, "CONFLICT", "Later-market evaluation is available only for recent Binance cases.");
    const observed = await getLaterBinanceCandles(session.source, plan.plan.asOf);
    const intervalSeconds = session.source.interval === "1d" ? 86400 : session.source.interval === "4h" ? 14400 : 3600;
    const planCreatedAt = Date.parse(plan.createdAt) / 1000;
    if (!observed.some((bar) => bar.time + intervalSeconds > planCreatedAt)) {
      throw new SessionError(409, "CONFLICT", "No candle has closed since this analysis was confirmed. Recheck later.");
    }
    const frozen = new Map(record.snapshot.candles.map((bar) => [bar.time, bar]));
    for (const bar of observed) if (frozen.has(bar.time) && JSON.stringify(frozen.get(bar.time)) !== JSON.stringify(bar)) throw new MarketDataError(502, "Binance data conflicts with the frozen snapshot.");
    const last = observed.at(-1)?.time ?? plan.plan.asOf;
    const previous = session.analysis!.evaluations.filter((item) => item.planId === plan.id && item.mode === "later-market").at(-1);
    if (last <= (previous?.observedThrough ?? plan.plan.asOf)) throw new SessionError(409, "CONFLICT", "No newly closed market candle is available.");
    const later = observed.filter((bar) => bar.time > (record.snapshot.candles.at(-1)?.time ?? 0));
    const visibleCandles = [...record.snapshot.candles, ...later];
    const cursor = visibleCandles.length - 1;
    const learning = { ...session.learning!, asOf: visibleCandles.at(-1)!.time, snapshotId: visibleSnapshotId(visibleCandles) };
    const evaluation = { id: randomUUID(), planId: plan.id, caseId: plan.caseId, mode: "later-market" as const, observedFrom: plan.plan.asOf,
      observedThrough: last, createdAt: new Date().toISOString(), objectiveFeedback: [`Observed ${observed.length} new closed candles.`], observation: "Compare the new market with the original hypothesis and record a reflection." };
    const analysis = { ...session.analysis!, evaluations: [...session.analysis!.evaluations, evaluation] };
    const updated: SessionView = { ...session, cursor, totalCandles: Math.max(session.totalCandles, visibleCandles.length), visibleCandles, learning, analysis, complete: advancedComplete(record, analysis) };
    await writeSession({ ...record, view: updated, laterCandles: later });
    return updated;
  });
}

export function reflectAnalysis(id: string, planId: string, reason: string): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const session = record.view;
    const state = analysisState(session);
    const plan = state.plans.find((item) => item.id === planId && item.caseId === caseId(session));
    if (!plan || !state.evaluations.some((item) => item.planId === planId && item.caseId === plan.caseId && item.observedThrough > plan.plan.asOf)) throw new SessionError(409, "CONFLICT", "Observe a new candle for this case and plan before reflecting.");
    if (state.reflections?.some((item) => item.planId === planId)) throw new SessionError(409, "CONFLICT", "Reflection is already recorded for this plan.");
    const reflection = { planId, caseId: plan.caseId, reason, createdAt: new Date().toISOString() };
    const analysis = { ...state, reflection, reflections: [...(state.reflections ?? []), reflection] };
    const updated: SessionView = { ...session, analysis, complete: advancedComplete(record, analysis) };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}
