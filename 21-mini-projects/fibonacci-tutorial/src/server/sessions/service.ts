import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { calculateFibonacci } from "@/entities/fibonacci";
import { evaluateLongPlan, tradeMetrics, tradeEvaluationJsonSchema, type TradeEvaluation } from "@/entities/trade-evaluation";
import { tradePlanJsonSchema, validateLongPrices, type ConfirmPlanInput, type TradePlan } from "@/entities/trade-plan";
import { selectImpulsePoints, selectWavePoints, validateImpulse } from "@/entities/wave";
import { type SessionView, type SourceConfig, type ValidationResult } from "@/entities/tutorial";
import { getTutorialContent } from "@/entities/tutorial/content/server";
import { createScenarioSnapshot, type ScenarioSnapshot } from "@/server/candle-data/registry";
import { getLaterBinanceCandles, MarketDataError } from "@/server/candle-data/binance";
import { readSession, serializeMutation, writeSession, type SessionRecord } from "./repository";
import { getLessonDefinition } from "@/entities/lesson/server";
import { analysisPlanSchema, analysisRevisionSchema, analysisEvaluationSchema, learningViewSchema } from "@/entities/lesson";
import { z } from "zod";
import { createMonitoringState, monitoringEventSchema, monitoringStateSchema, type MonitoringConfig } from "@/entities/strategy-monitor";
import { monitorLaterCandles, monitorNextCandle, monitoringHistoryWith, monitoringSummary, viewWithRestoredMonitoring } from "./monitoring";
import { advanceAdvancedTheory, createAdvancedSession, revealLessonHint } from "./lesson";

export class SessionError extends Error {
  constructor(public readonly status: 400 | 404 | 409 | 502 | 503, public readonly code: "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "UPSTREAM_ERROR", message: string) { super(message); }
}

function unitContent(unitId: string) {
  const content = getTutorialContent(unitId);
  if (!content) throw new SessionError(400, "VALIDATION_ERROR", "Unknown tutorial unit.");
  return content;
}

function ensureTask(session: SessionView, task: "theory" | "count" | "fibonacci" | "trade"): void {
  if (session.unit?.task !== task) throw new SessionError(409, "CONFLICT", `This unit does not support ${task}.`);
}

export function createSession(unitId: string, source: SourceConfig = { type: "dummy" }): Promise<SessionView> {
  if (getLessonDefinition(unitId)) return createAdvancedSession(unitId, source);
  return serializeMutation(async () => {
    const content = unitContent(unitId);
    if (!content.summary.allowedSources.includes(source.type)) throw new SessionError(400, "VALIDATION_ERROR", "Source is unavailable for this unit.");
    let scenario: Awaited<ReturnType<typeof createScenarioSnapshot>>;
    try { scenario = await createScenarioSnapshot(unitId, source); }
    catch (error) { if (error instanceof MarketDataError) throw error; throw new SessionError(400, "VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid scenario."); }
    const { snapshot } = scenario;
    const steps = content.steps ?? [];
    const firstStep = steps[0];
    const cursor = firstStep ? Math.min(firstStep.visibleCount - 1, snapshot.candles.length - 1) : scenario.initialCursor;
    const session: SessionView = {
      id: randomUUID(), unitId, unit: content.summary, source,
      cursor, visibleCandles: snapshot.candles.slice(0, cursor + 1), totalCandles: snapshot.candles.length,
      plan: null, plans: [], evaluations: [], complete: false,
      theoryStep: 0, theoryStepCount: steps.length,
      instruction: firstStep ? { title: firstStep.title, description: firstStep.description, showFibonacci: firstStep.showFibonacci }
        : { title: content.summary.title, description: content.summary.description, showFibonacci: content.summary.task === "fibonacci" },
      selectedIndices: firstStep?.waveIndices ?? [], validation: [], hint: null, exampleIndices: null,
      reflection: null, learning: null, analysis: null, monitoring: null, monitoringHistory: [],
    };
    await writeSession({ view: session, snapshot });
    return session;
  });
}

export async function getSession(id: string): Promise<SessionView> { return viewWithRestoredMonitoring(await getSessionRecord(id)); }

export function advanceSession(id: string, expectedStep: number, direction: "next" | "prev" = "next"): Promise<SessionView> {
  // Advanced steps have an independent 5-step and quiz completion contract.
  return advanceSessionByKind(id, expectedStep, direction);
}

async function advanceSessionByKind(id: string, expectedStep: number, direction: "next" | "prev"): Promise<SessionView> {
  const session = await getSession(id);
  if (getLessonDefinition(session.unitId)) return advanceAdvancedTheory(id, expectedStep, direction);
  return serializeMutation(async () => {
    const record = await getSessionRecord(id);
    const session = record.view;
    ensureTask(session, "theory");
    if (session.theoryStep !== expectedStep) throw new SessionError(409, "CONFLICT", "Theory step is stale.");
    if (session.complete && direction === "next") throw new SessionError(409, "CONFLICT", "Theory unit is complete.");
    if (direction === "prev" && expectedStep === 0) throw new SessionError(409, "CONFLICT", "Already at the first theory step.");
    const steps = unitContent(session.unitId).steps ?? [];
    const targetStep = expectedStep + (direction === "prev" ? -1 : 1);
    const nextStep = steps[targetStep];
    const updated: SessionView = nextStep ? {
      ...session, theoryStep: targetStep, complete: false,
      cursor: Math.min(nextStep.visibleCount - 1, record.snapshot.candles.length - 1),
      visibleCandles: record.snapshot.candles.slice(0, nextStep.visibleCount),
      selectedIndices: nextStep.waveIndices,
      instruction: { title: nextStep.title, description: nextStep.description, showFibonacci: nextStep.showFibonacci },
      hint: null, exampleIndices: null,
    } : { ...session, complete: true };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}

export function checkSession(id: string, waveIndices: number[]): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await getSessionRecord(id);
    const session = record.view;
    if (session.unit?.task !== "count" && session.unit?.task !== "fibonacci") throw new SessionError(409, "CONFLICT", "This unit does not support checking.");
    if (session.complete) throw new SessionError(409, "CONFLICT", "Unit is already complete.");
    if (waveIndices.length !== session.unit.selectionCount) throw new SessionError(400, "VALIDATION_ERROR", `Select ${session.unit.selectionCount} wave points.`);
    if (waveIndices.some((index, position) => index > session.cursor || (position > 0 && index <= waveIndices[position - 1]))) {
      throw new SessionError(400, "VALIDATION_ERROR", "Wave points must be ordered and inside the visible range.");
    }
    let validation: ValidationResult[];
    try {
      if (waveIndices.length === 6) {
        const points = selectImpulsePoints(session.visibleCandles, waveIndices);
        validation = validateImpulse(points);
      } else {
        selectWavePoints(session.visibleCandles, waveIndices as [number, number, number]);
        validation = [{ rule: "wave-anchors", pass: true, reason: "Waves 0–2 form a valid upward retracement." }];
      }
    } catch (error) {
      validation = [{ rule: "wave-anchors", pass: false, reason: error instanceof Error ? error.message : "Invalid wave points." }];
    }
    const updated = { ...session, selectedIndices: waveIndices, validation, complete: validation.every((item) => item.pass) };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}

export function revealHint(id: string, kind: "hint" | "example"): Promise<SessionView> {
  return revealHintByKind(id, kind);
}

async function revealHintByKind(id: string, kind: "hint" | "example"): Promise<SessionView> {
  const session = await getSession(id);
  if (getLessonDefinition(session.unitId)) return revealLessonHint(id, kind);
  return serializeMutation(async () => {
    const record = await getSessionRecord(id);
    const session = record.view;
    if (session.unit?.task === "trade" && !session.complete) throw new SessionError(409, "CONFLICT", "Trade answers are unavailable before replay ends.");
    if (session.unit?.task === "theory") throw new SessionError(409, "CONFLICT", "Theory steps do not have practice hints.");
    if (kind === "example" && session.unit?.task !== "trade" && session.validation.length === 0) throw new SessionError(409, "CONFLICT", "Check a wave count before revealing an example.");
    const content = unitContent(session.unitId);
    const updated = kind === "hint" ? { ...session, hint: content.hint } : { ...session, exampleIndices: content.exampleIndices.filter((index) => index <= session.cursor) };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}

export function confirmPlan(id: string, input: ConfirmPlanInput): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await getSessionRecord(id);
    const session = record.view;
    ensureTask(session, "trade");
    if (session.plan !== null) throw new SessionError(409, "CONFLICT", "Plan is already confirmed.");
    if (session.complete && (session.source.type !== "binance" || session.plans.length === 0)) throw new SessionError(409, "CONFLICT", "Scenario is complete.");
    const plan = createPlan(session, record.snapshot, input);
    const monitoring = createMonitoringState(plan, plan.createdAt, session.visibleCandles.at(-1)?.close);
    const updated = { ...session, plan, plans: [...session.plans, plan], selectedIndices: input.waveIndices, validation: plan.validation,
      monitoring, monitoringHistory: monitoringHistoryWith(session.monitoringHistory, monitoring) };
    await writeSession({ ...record, view: updated, planSnapshots: { ...record.planSnapshots, [plan.id]: session.visibleCandles.map((bar) => ({ ...bar })) } });
    return updated;
  });
}

export function revisePlan(id: string, expectedPlanId: string): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await getSessionRecord(id);
    const session = record.view;
    ensureTask(session, "trade");
    if (!session.plan || session.plan.id !== expectedPlanId) throw new SessionError(409, "CONFLICT", "Active plan ID is stale.");
    if (session.complete && session.source.type !== "binance") throw new SessionError(409, "CONFLICT", "Completed dummy scenarios have no later candles for a revision.");
    const updated = { ...session, plan: null, validation: [], reflection: null, complete: false, monitoring: null };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}

export function replaySession(id: string, expectedCursor: number): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await getSessionRecord(id);
    const session = viewWithRestoredMonitoring(record);
    ensureTask(session, "trade");
    if (session.plan === null) throw new SessionError(409, "CONFLICT", "Confirm a plan before replay.");
    if (expectedCursor !== session.cursor) throw new SessionError(409, "CONFLICT", "Replay cursor is stale.");
    if (session.complete) throw new SessionError(409, "CONFLICT", "Scenario is complete.");
    if (session.cursor >= record.snapshot.candles.length - 1) throw new SessionError(409, "CONFLICT", "No frozen replay candles remain; evaluate later closed market data.");
    const plan = session.plan;
    const planCandles = record.planSnapshots?.[plan.id];
    const planSnapshotId = planCandles ? snapshotDigest(planCandles) : record.snapshot.id;
    if (plan.snapshotId !== planSnapshotId) throw new SessionError(409, "CONFLICT", "Session snapshot does not match the confirmed plan.");
    const cursor = session.cursor + 1;
    const visibleCandles = record.snapshot.candles.slice(0, cursor + 1);
    const isFinalCandle = cursor === record.snapshot.candles.length - 1;
    const observed = visibleCandles.filter((candle) => candle.time > plan.asOf);
    const result = evaluateLongPlan(plan, observed, isFinalCandle);
    const evaluation = makeEvaluation(plan, record.snapshot.id, "replay", observed, result);
    const monitoring = monitorNextCandle(session, plan, record.snapshot.candles[cursor], isFinalCandle);
    evaluation.monitoringSummary = monitoringSummary(monitoring);
    evaluation.feedback.push({ rule: "strategy-monitor", pass: monitoring.health !== "invalidated", reason: evaluation.monitoringSummary });
    const updated: SessionView = { ...session, cursor, visibleCandles, complete: isFinalCandle, evaluations: [...session.evaluations, evaluation],
      monitoring, monitoringHistory: monitoringHistoryWith(session.monitoringHistory, monitoring) };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}

export function evaluateLaterMarket(id: string): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await getSessionRecord(id);
    const session = viewWithRestoredMonitoring(record);
    ensureTask(session, "trade");
    const plan = session.plan;
    if (!plan) throw new SessionError(409, "CONFLICT", "Confirm a plan before evaluation.");
    if (session.source.type !== "binance") throw new SessionError(409, "CONFLICT", "Later-market evaluation requires Binance data.");
    const observed = await getLaterBinanceCandles(session.source, plan.asOf);
    const frozenByTime = new Map(record.snapshot.candles.map((bar) => [bar.time, bar]));
    for (const bar of observed) {
      const frozen = frozenByTime.get(bar.time);
      if (frozen && JSON.stringify(frozen) !== JSON.stringify(bar)) {
        throw new MarketDataError(502, "Binance data conflicts with the immutable session snapshot.");
      }
    }
    const last = observed.at(-1)?.time ?? plan.asOf;
    const previous = session.evaluations.filter((item) => item.planId === plan.id && item.evaluationMode === "later-market").at(-1);
    const result = observed.length ? evaluateLongPlan(plan, observed, false) : { status: "pending" as const, entryPrice: null, exitPrice: null, resultR: null, reason: "No new closed market candles after the plan time." };
    const dataId = `sha256:${createHash("sha256").update(JSON.stringify({ source: session.source, observed })).digest("hex")}`;
    const evaluation = makeEvaluation(plan, dataId, "later-market", observed, result);
    const monitoring = monitorLaterCandles(session, plan, observed);
    evaluation.monitoringSummary = monitoringSummary(monitoring);
    evaluation.feedback.push({ rule: "strategy-monitor", pass: monitoring.health !== "invalidated", reason: evaluation.monitoringSummary });
    if (previous && previous.observedThrough === last) evaluation.feedback.push({ rule: "new-market-data", pass: false, reason: "No newly closed candles since the previous evaluation." });
    const snapshotEnd = record.snapshot.candles.at(-1)?.time ?? 0;
    const laterCandles = observed.filter((bar) => bar.time > snapshotEnd);
    const visibleCandles = observed.length ? [...record.snapshot.candles, ...laterCandles] : session.visibleCandles;
    const updated: SessionView = {
      ...session, visibleCandles, cursor: visibleCandles.length - 1, totalCandles: Math.max(session.totalCandles, visibleCandles.length),
      complete: session.complete || observed.length > 0, evaluations: [...session.evaluations, evaluation],
      monitoring, monitoringHistory: monitoringHistoryWith(session.monitoringHistory, monitoring),
    };
    await writeSession({ ...record, view: updated, laterCandles });
    return updated;
  });
}

export function saveReflection(id: string, decision: "close" | "hold", reason: string): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await getSessionRecord(id);
    const session = record.view;
    ensureTask(session, "trade");
    if (!session.plan || !session.complete) throw new SessionError(409, "CONFLICT", "Observe the scenario before recording an exit judgment.");
    if (session.reflection) throw new SessionError(409, "CONFLICT", "Exit judgment is already recorded.");
    const updated: SessionView = { ...session, reflection: { decision, reason, createdAt: new Date().toISOString(), asOf: session.visibleCandles.at(-1)!.time, planId: session.plan.id } };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}

export async function exportSession(id: string) {
  const session = await getSession(id);
  if (getLessonDefinition(session.unitId)) return { schemaVersion: "2", session, schemas: {
    analysisPlan: z.toJSONSchema(analysisPlanSchema), analysisRevision: z.toJSONSchema(analysisRevisionSchema),
    analysisEvaluation: z.toJSONSchema(analysisEvaluationSchema), learningView: z.toJSONSchema(learningViewSchema),
  } };
  return { schemaVersion: "1", session, monitoringAudit: {
    events: session.monitoringHistory.flatMap((state) => state.events),
    note: "Monitoring events are the audit record. A manual abort without an earlier TradeEvaluation appears only in this event history.",
  }, schemas: { tradePlan: tradePlanJsonSchema, tradeEvaluation: tradeEvaluationJsonSchema,
    monitoringState: z.toJSONSchema(monitoringStateSchema), monitoringEvent: z.toJSONSchema(monitoringEventSchema) } };
}

async function getSessionRecord(id: string): Promise<SessionRecord> {
  const record = await readSession(id);
  if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
  return record;
}

function createPlan(session: SessionView, snapshot: ScenarioSnapshot, input: ConfirmPlanInput): TradePlan {
  try {
    validateLongPrices(input);
    const points = selectWavePoints(session.visibleCandles, input.waveIndices);
    const previous = session.plans.at(-1);
    const decisions = input.decisionReasons ?? {
      wave: input.rationale, fibonacci: input.rationale, entry: input.rationale,
      stopLoss: input.rationale, target: input.rationale, invalidation: input.rationale,
      exit: input.exitStrategy ?? input.rationale,
    };
    const monitoringConfig = resolveMonitoringConfig(session, input, points[0].price, points[1].price);
    return {
      schemaVersion: "1", id: randomUUID(), sessionId: session.id, unitId: session.unitId,
      createdAt: new Date().toISOString(), asOf: session.visibleCandles[session.cursor].time,
      snapshotId: snapshotDigest(session.visibleCandles), source: snapshot.source, sourceConfig: session.source,
      wavePoints: points, entry: input.entry, stopLoss: input.stopLoss, target: input.target,
      rationale: input.rationale, fibonacci: calculateFibonacci(points), policyVersion: "touch-v1",
      revision: (previous?.revision ?? 0) + 1, previousPlanId: previous?.id ?? null,
      scenarioId: session.unitId, invalidationPrice: points[0].price,
      decisions, exitStrategy: input.exitStrategy ?? decisions.exit,
      monitoringConfig,
      validation: [{ rule: "long-prices", pass: true, reason: "Stop loss is below entry and target is above entry." }],
    };
  } catch (error) {
    if (error instanceof Error) throw new SessionError(400, "VALIDATION_ERROR", error.message);
    throw error;
  }
}

function resolveMonitoringConfig(session: SessionView, input: ConfirmPlanInput, wave0Price: number, wave1Price: number): MonitoringConfig {
  const policy = input.monitoring?.policy ?? "auto-abort";
  const requested = input.monitoring?.rule;
  if (!requested || requested.kind === "price-level") {
    const level = requested?.level ?? wave0Price;
    if (level >= input.entry) throw new Error("Invalidation level must be below the long entry price.");
    if (session.visibleCandles.at(-1)!.close <= level) throw new Error("Invalidation level must be below the latest public close.");
    return { policy, rule: { kind: "price-level", level } };
  }
  const wave2Index = input.waveIndices[2];
  const wave3Index = requested.wave3Index;
  if (wave3Index <= wave2Index || wave3Index > session.cursor) throw new Error("Confirmed Wave 3 index must be after Wave 2 and already public.");
  const wave3 = session.visibleCandles[wave3Index];
  const crossedWave1 = session.visibleCandles.slice(wave2Index + 1, wave3Index + 1).some((candle) => candle.high > wave1Price);
  if (!wave3 || wave3.high <= wave1Price || !crossedWave1) throw new Error("Confirmed Wave 3 must visibly exceed the Wave 1 high.");
  if (session.visibleCandles.slice(wave3Index + 1).some((candle) => candle.low <= wave1Price)) {
    throw new Error("Wave 4 overlap boundary has already been touched after the confirmed Wave 3.");
  }
  return { policy, rule: { kind: "wave4-overlap", wave3Index, wave3Time: wave3.time, level: wave1Price } };
}

function makeEvaluation(plan: TradePlan, snapshotId: string, evaluationMode: "replay" | "later-market", observed: SessionView["visibleCandles"], result: ReturnType<typeof evaluateLongPlan>): TradeEvaluation {
  const feedback: ValidationResult[] = [
    { rule: "as-of-boundary", pass: true, reason: `Observed ${observed.length} closed candles after the plan time ${plan.asOf}.` },
    { rule: "count", pass: plan.wavePoints.length === 3, reason: `Waves 0–2 were anchored at ${plan.wavePoints.map((point) => point.price).join(" → ")}; ${plan.decisions?.wave ?? plan.rationale}` },
    { rule: "fibonacci", pass: true, reason: `Wave 2 retracement ${plan.fibonacci.retracement}; 1.618 extension ${plan.fibonacci.extension1618}. ${plan.decisions?.fibonacci ?? plan.rationale}` },
    { rule: "entry", pass: result.entryPrice !== null, reason: result.entryPrice === null ? `Entry ${plan.entry} has not filled. ${plan.decisions?.entry ?? plan.rationale}` : `Entry filled at ${result.entryPrice}. ${plan.decisions?.entry ?? plan.rationale}` },
    { rule: "stop-loss", pass: result.status !== "stop", reason: `Stop loss ${plan.stopLoss}; ${plan.decisions?.stopLoss ?? plan.rationale}` },
    { rule: "target", pass: result.status === "target", reason: `Target ${plan.target}; ${plan.decisions?.target ?? plan.rationale}` },
    { rule: "invalidation", pass: true, reason: `Count invalidation ${plan.invalidationPrice ?? plan.wavePoints[0].price} is a wave premise, separate from the stop loss ${plan.stopLoss}. ${plan.decisions?.invalidation ?? plan.rationale}` },
    { rule: "exit", pass: result.exitPrice !== null, reason: `${result.reason} Exit strategy: ${plan.exitStrategy}` },
  ];
  return {
    id: randomUUID(), planId: plan.id, evaluatedAt: new Date().toISOString(),
    observedThrough: observed.at(-1)?.time ?? plan.asOf,
    observedFrom: observed[0]?.time ?? plan.asOf,
    schemaVersion: "1", evaluationMode, snapshotId,
    ...result, ...tradeMetrics(plan, result.entryPrice, result.exitPrice),
    feedback,
  };
}

function snapshotDigest(candles: SessionView["visibleCandles"]): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(candles)).digest("hex")}`;
}
