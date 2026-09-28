import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { candleSchema } from "@/entities/candle";
import { calculateFibonacci } from "@/entities/fibonacci";
import { selectWavePoints } from "@/entities/wave";
import { abortMonitoring, advanceMonitoring, createMonitoringState } from "@/entities/strategy-monitor";
import { monitoringEventSchema, monitoringStateSchema } from "@/entities/strategy-monitor/@x";
import {
  evaluateStrategyRun, strategyAbortInputSchema, strategyActionInputSchema, strategyConfirmInputSchema,
  strategyDraftInputSchema, strategyDraftUpdateSchema, strategyReviseInputSchema, strategyRunInputSchema,
  strategyPlanSchema, strategyRunSchema, strategyViewSchema,
  type StrategyConfirmInput, type StrategyMode, type StrategyPlan, type StrategyRun,
  type StrategySummary, type StrategyView,
} from "@/entities/strategy";
import type { MonitoringConfig } from "@/entities/strategy-monitor";
import type { Candle } from "@/entities/candle";
import { createStrategySnapshot, getForwardBinanceBars } from "./data";
import { snapshotDigest } from "./data";
import { MarketDataError } from "@/server/candle-data/binance";
import { listStrategies, readStrategy, serializeStrategyMutation, writeStrategy, type StrategyRecord } from "./repository";

export class StrategyError extends Error {
  constructor(public readonly status: 400 | 404 | 409, public readonly code: string, message: string) { super(message); }
}
const nowIso = (): string => new Date().toISOString();
const terminal = new Set(["CLOSED_TP", "CLOSED_SL", "INVALIDATED_STOP", "EXPIRED", "ABORTED", "INDETERMINATE"]);
const versioned = (view: StrategyView, expectedVersion: number): void => {
  if (view.version !== expectedVersion) throw new StrategyError(409, "STALE_VERSION", "The strategy changed. Reload before editing or running it.");
};
const requireDraft = (view: StrategyView): void => {
  if (view.status !== "DRAFT") throw new StrategyError(409, "NOT_DRAFT", "Create a new revision before changing the confirmed plan.");
};
const requirePlan = (view: StrategyView): StrategyPlan => {
  if (view.status !== "CONFIRMED" || !view.plan) throw new StrategyError(409, "PLAN_REQUIRED", "Confirm the strategy plan first.");
  return view.plan;
};
const snapshot = (record: StrategyRecord) => {
  const result = record.snapshots[record.view.snapshotId];
  if (!result) throw new Error("Saved strategy snapshot is missing.");
  return result;
};
const currentRun = (record: StrategyRecord, runId: string): StrategyRun => {
  const run = record.view.runs.find((item) => item.id === runId);
  if (!run || run.strategyId !== record.view.id) throw new StrategyError(404, "RUN_NOT_FOUND", "Run not found.");
  return run;
};
async function requiredRecord(id: string): Promise<StrategyRecord> {
  const record = await readStrategy(id);
  if (!record) throw new StrategyError(404, "STRATEGY_NOT_FOUND", "Strategy not found.");
  return record;
}
function updateRecord(record: StrategyRecord): Promise<StrategyView> {
  record.view.version += 1;
  record.view.updatedAt = nowIso();
  return writeStrategy(record).then(() => record.view);
}
function visibleForRun(record: StrategyRecord, run: StrategyRun): Candle[] {
  const candles = record.runCandles[run.id];
  if (!candles) throw new Error("Saved run candles are missing.");
  return candles.slice(0, run.cursor + 1);
}
function updateRun(record: StrategyRecord, run: StrategyRun): void {
  run.observedSnapshotId = snapshotDigest(run.source, visibleForRun(record, run));
  run.evaluation = evaluateStrategyRun(run);
  const index = record.view.runs.findIndex((item) => item.id === run.id);
  record.view.runs[index] = run;
  if (record.view.activeRunId === run.id) record.view.visibleCandles = visibleForRun(record, run);
}

export async function listStrategyViews(): Promise<{ strategies: StrategySummary[] }> {
  const records = await listStrategies();
  return { strategies: records.map(({ view }) => ({
    id: view.id, title: view.title, mode: view.mode, source: view.source, status: view.status,
    asOf: view.asOf, updatedAt: view.updatedAt, latestRun: view.runs.at(-1) ?? null,
  })).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) };
}
export async function getStrategyView(id: string): Promise<StrategyView> { return (await requiredRecord(id)).view; }

export async function createStrategy(input: unknown): Promise<StrategyView> {
  const data = strategyDraftInputSchema.parse(input);
  return serializeStrategyMutation(async () => {
    let selected;
    try { selected = await createStrategySnapshot(data.source, data.mode, data.asOf, data.backtestBars); }
    catch (error) { if (error instanceof Error && !("status" in error)) throw new StrategyError(400, "DATA_SELECTION_ERROR", error.message); throw error; }
    const id = randomUUID(), timestamp = nowIso();
    const asOf = selected.candles[selected.initialCursor].time;
    const view: StrategyView = {
      id, title: data.title, mode: data.mode, source: data.source, status: "DRAFT", version: 1,
      createdAt: timestamp, updatedAt: timestamp, asOf, snapshotId: selected.id,
      visibleCandles: selected.candles.slice(0, selected.initialCursor + 1), dataset: selected.dataset,
      backtestBars: data.backtestBars, draftPlan: {}, plan: null, plans: [], runs: [], activeRunId: null,
    };
    await writeStrategy({ view, snapshots: { [selected.id]: selected }, runCandles: {} });
    return view;
  });
}

export async function updateStrategyDraft(id: string, input: unknown): Promise<StrategyView> {
  const data = strategyDraftUpdateSchema.parse(input);
  return serializeStrategyMutation(async () => {
    const record = await requiredRecord(id); versioned(record.view, data.expectedVersion); requireDraft(record.view);
    const dataChanged = data.refreshData === true || (data.asOf !== undefined && data.asOf !== record.view.asOf);
    if (dataChanged) {
      let selected;
      try { selected = await createStrategySnapshot(record.view.source, record.view.mode, data.asOf ?? (record.view.mode === "BACKTEST" ? record.view.asOf : undefined), record.view.backtestBars); }
      catch (error) { if (error instanceof Error && !("status" in error)) throw new StrategyError(400, "DATA_SELECTION_ERROR", error.message); throw error; }
      record.snapshots[selected.id] = selected;
      record.view.asOf = selected.candles[selected.initialCursor].time;
      record.view.snapshotId = selected.id;
      record.view.dataset = selected.dataset;
      record.view.visibleCandles = selected.candles.slice(0, selected.initialCursor + 1);
      record.view.draftPlan = {};
    }
    if (data.title) record.view.title = data.title;
    if (data.draftPlan) {
      const indices = data.draftPlan.waveIndices ?? [];
      if (indices.some((index, position) => index >= record.view.visibleCandles.length || (position > 0 && index <= indices[position - 1]))) {
        throw new StrategyError(400, "INVALID_WAVES", "Draft wave points must be ordered and publicly visible.");
      }
      record.view.draftPlan = data.draftPlan;
    }
    return updateRecord(record);
  });
}

function validatedConfig(input: StrategyConfirmInput, points: StrategyPlan["wavePoints"], visible: readonly Candle[]): MonitoringConfig {
  if (!(input.stopLoss < input.entry && input.entry < input.target)) throw new StrategyError(400, "INVALID_PRICES", "Long plans require stopLoss < entry < target.");
  const requested = input.monitoring?.rule;
  let rule: MonitoringConfig["rule"];
  if (requested?.kind === "wave4-overlap") {
    if (requested.wave3Index <= points[2].candleIndex || requested.wave3Index >= visible.length) throw new StrategyError(400, "INVALID_RULE", "Select a public Wave 3 candle after Wave 2.");
    const wave3 = visible[requested.wave3Index];
    if (wave3.high <= points[1].price) throw new StrategyError(400, "INVALID_RULE", "Wave 3 must rise above Wave 1 high.");
    if (visible.slice(requested.wave3Index + 1).some((candle) => candle.low <= points[1].price)) throw new StrategyError(400, "INVALID_RULE", "Wave 4 overlap already occurred in public candles.");
    rule = { kind: "wave4-overlap", level: points[1].price, wave3Index: requested.wave3Index, wave3Time: wave3.time };
  } else {
    rule = { kind: "price-level", level: requested?.kind === "price-level" ? requested.level : points[0].price };
  }
  if (rule.kind === "price-level" && (rule.level >= input.entry || visible.at(-1)!.close <= rule.level)) {
    throw new StrategyError(400, "INVALID_RULE", "Price invalidation must be below entry and below the latest public close.");
  }
  return { policy: input.monitoring?.policy ?? "auto-abort", rule };
}

export async function confirmStrategy(id: string, input: unknown): Promise<StrategyView> {
  const data = strategyConfirmInputSchema.parse(input);
  return serializeStrategyMutation(async () => {
    const record = await requiredRecord(id); versioned(record.view, data.expectedVersion); requireDraft(record.view);
    const visible = record.view.visibleCandles;
    let points: StrategyPlan["wavePoints"];
    try { points = selectWavePoints(visible, data.waveIndices); }
    catch (error) { throw new StrategyError(400, "INVALID_WAVES", error instanceof Error ? error.message : "Invalid wave points."); }
    const monitoringConfig = validatedConfig(data, points, visible);
    if (record.view.mode === "FORWARD" && record.view.source.type === "binance") {
      const latest = await createStrategySnapshot(record.view.source, "FORWARD");
      if (latest.candles.at(-1)!.time !== record.view.asOf || latest.id !== record.view.snapshotId) {
        throw new StrategyError(409, "STALE_MARKET_DRAFT", "A new Binance candle closed. Reopen a current forward draft before confirming.");
      }
    }
    const previous = record.view.plans.at(-1) ?? null;
    const plan: StrategyPlan = {
      schemaVersion: "1", id: randomUUID(), strategyId: record.view.id, revision: (previous?.revision ?? 0) + 1,
      previousPlanId: previous?.id ?? null, createdAt: nowIso(), asOf: record.view.asOf,
      snapshotId: record.view.snapshotId, source: record.view.source, mode: record.view.mode,
      wavePoints: points, entry: data.entry, stopLoss: data.stopLoss, target: data.target,
      fibonacci: calculateFibonacci(points), invalidationPrice: monitoringConfig.rule.level,
      rationale: data.rationale, decisions: data.decisionReasons,
      exitStrategy: data.exitStrategy ?? "5파 이후 조정 가능성을 확인하고 청산을 검토합니다.",
      monitoringConfig, policyVersion: "touch-v1",
    };
    record.view.plan = plan; record.view.plans.push(plan); record.view.status = "CONFIRMED";
    record.view.draftPlan = { waveIndices: [...data.waveIndices], entry: data.entry, stopLoss: data.stopLoss, target: data.target,
      rationale: data.rationale, decisionReasons: data.decisionReasons, exitStrategy: data.exitStrategy, monitoring: data.monitoring };
    return updateRecord(record);
  });
}

export async function reviseStrategy(id: string, input: unknown): Promise<StrategyView> {
  const data = strategyReviseInputSchema.parse(input);
  return serializeStrategyMutation(async () => {
    const record = await requiredRecord(id); versioned(record.view, data.expectedVersion); requirePlan(record.view);
    const mode = data.mode ?? record.view.mode, source = data.source ?? record.view.source;
    let selected;
    try { selected = await createStrategySnapshot(source, mode, data.asOf ?? (mode === "BACKTEST" ? record.view.asOf : undefined), record.view.backtestBars); }
    catch (error) { if (error instanceof Error && !("status" in error)) throw new StrategyError(400, "DATA_SELECTION_ERROR", error.message); throw error; }
    record.snapshots[selected.id] = selected;
    record.view.mode = mode; record.view.source = source; record.view.asOf = selected.candles[selected.initialCursor].time;
    record.view.snapshotId = selected.id; record.view.dataset = selected.dataset;
    record.view.visibleCandles = selected.candles.slice(0, selected.initialCursor + 1);
    record.view.status = "DRAFT"; record.view.plan = null; record.view.activeRunId = null;
    record.view.draftPlan = {};
    return updateRecord(record);
  });
}

export async function startStrategyRun(id: string, input: unknown): Promise<StrategyView> {
  const data = strategyRunInputSchema.parse(input);
  return serializeStrategyMutation(async () => {
    const record = await requiredRecord(id); versioned(record.view, data.expectedVersion);
    const plan = requirePlan(record.view), selected = snapshot(record);
    if (plan.mode !== data.mode) throw new StrategyError(409, "MODE_MISMATCH", "Create and confirm a new revision for the requested test mode.");
    const timestamp = nowIso(), initialClose = selected.candles[selected.initialCursor].close;
    const monitoring = createMonitoringState(plan, timestamp, initialClose);
    const run: StrategyRun = {
      id: randomUUID(), strategyId: id, planId: plan.id, revision: plan.revision,
      mode: data.mode, source: plan.source, snapshotId: plan.snapshotId, policyVersion: "touch-v1",
      controlStatus: "WAITING", lastError: null, startedAt: timestamp, endedAt: null, lastObservedAt: null,
      dataRange: { startTime: plan.asOf, endTime: data.mode === "BACKTEST" ? selected.candles.at(-1)!.time : plan.asOf },
      cursor: selected.initialCursor, observedCount: 0, monitoring,
      observedSnapshotId: snapshotDigest(plan.source, selected.candles.slice(0, selected.initialCursor + 1)),
      evaluation: { asOf: plan.asOf, observedThrough: plan.asOf, observedCount: 0, status: "PENDING",
        entryPrice: null, exitPrice: null, realizedR: null, realizedPnl: null,
        unrealizedPnl: null, liveR: null, indeterminate: false, reason: null },
    };
    run.evaluation = evaluateStrategyRun(run);
    record.runCandles[run.id] = selected.candles.map((candle) => ({ ...candle }));
    record.view.runs.push(run); record.view.activeRunId = run.id;
    record.view.visibleCandles = selected.candles.slice(0, selected.initialCursor + 1);
    return updateRecord(record);
  });
}

function ensureRunnable(record: StrategyRecord, run: StrategyRun, mode: StrategyMode): StrategyPlan {
  if (run.mode !== mode) throw new StrategyError(409, "MODE_MISMATCH", `This action requires a ${mode} run.`);
  if (run.controlStatus === "PAUSED" || run.controlStatus === "COMPLETED" || run.controlStatus === "ERROR") throw new StrategyError(409, "RUN_NOT_ACTIVE", "Resume or start an active run first.");
  const plan = record.view.plans.find((candidate) => candidate.id === run.planId);
  if (!plan) throw new Error("Saved run plan is missing.");
  return plan;
}
function advanceRun(record: StrategyRecord, run: StrategyRun, plan: StrategyPlan, candle: Candle, isFinal: boolean): void {
  if (candle.time <= run.monitoring.observedThrough) return;
  run.monitoring = advanceMonitoring(run.monitoring, plan, candle, nowIso(), isFinal);
  run.observedCount += 1; run.cursor += 1; run.lastObservedAt = nowIso();
  if (run.mode === "FORWARD") run.dataRange.endTime = candle.time;
  run.controlStatus = terminal.has(run.monitoring.status) || (isFinal && run.mode === "BACKTEST") ? "COMPLETED" : "RUNNING";
  if (run.controlStatus === "COMPLETED") run.endedAt = nowIso();
  updateRun(record, run);
}

export async function advanceBacktest(id: string, runId: string, input: unknown, batch: boolean): Promise<StrategyView> {
  const data = strategyActionInputSchema.parse(input);
  return serializeStrategyMutation(async () => {
    const record = await requiredRecord(id); versioned(record.view, data.expectedVersion);
    const run = currentRun(record, runId), plan = ensureRunnable(record, run, "BACKTEST");
    const candles = record.runCandles[run.id];
    if (run.cursor >= candles.length - 1) throw new StrategyError(409, "HORIZON_COMPLETE", "The backtest horizon is complete.");
    do {
      const next = candles[run.cursor + 1];
      advanceRun(record, run, plan, next, run.cursor + 1 === candles.length - 1);
    } while (batch && run.controlStatus !== "COMPLETED" && run.cursor < candles.length - 1);
    return updateRecord(record);
  });
}

export async function pollForward(id: string, runId: string, input: unknown): Promise<StrategyView> {
  const data = strategyActionInputSchema.parse(input);
  return serializeStrategyMutation(async () => {
    const record = await requiredRecord(id); versioned(record.view, data.expectedVersion);
    const run = currentRun(record, runId), plan = ensureRunnable(record, run, "FORWARD");
    const candles = record.runCandles[run.id];
    let later: Candle[];
    if (run.source.type === "dummy") later = candles[run.cursor + 1] ? [candles[run.cursor + 1]] : [];
    else {
      try { later = await getForwardBinanceBars(run.source, run.monitoring.observedThrough); }
      catch (error) {
        if (error instanceof MarketDataError) {
          run.controlStatus = "ERROR";
          run.lastError = { code: "UPSTREAM_ERROR", message: error.message, at: nowIso() };
          updateRun(record, run);
          await updateRecord(record);
        }
        throw error;
      }
      if (later.length) record.runCandles[run.id] = [...candles, ...later];
    }
    for (const candle of later) {
      advanceRun(record, run, plan, candle, false);
      if (run.controlStatus === "COMPLETED") break;
    }
    if (later.length === 0 && run.controlStatus !== "COMPLETED") run.controlStatus = "WAITING";
    updateRun(record, run);
    return updateRecord(record);
  });
}

export async function controlStrategyRun(id: string, runId: string, action: "pause" | "resume" | "abort", input: unknown): Promise<StrategyView> {
  const data = action === "abort" ? strategyAbortInputSchema.parse(input) : strategyActionInputSchema.parse(input);
  return serializeStrategyMutation(async () => {
    const record = await requiredRecord(id); versioned(record.view, data.expectedVersion);
    const run = currentRun(record, runId);
    if (run.controlStatus === "COMPLETED") throw new StrategyError(409, "RUN_TERMINAL", "The run has already ended.");
    if (action === "pause") {
      if (run.controlStatus === "PAUSED" || run.controlStatus === "ERROR") throw new StrategyError(409, "ALREADY_PAUSED", "The run is already paused or waiting for retry.");
      run.controlStatus = "PAUSED";
    } else if (action === "resume") {
      if (run.controlStatus !== "PAUSED" && run.controlStatus !== "ERROR") throw new StrategyError(409, "NOT_PAUSED", "Only paused or errored runs can resume.");
      run.controlStatus = "RUNNING";
      run.lastError = null;
    } else {
      const plan = record.view.plans.find((candidate) => candidate.id === run.planId);
      if (!plan) throw new Error("Saved run plan is missing.");
      const candle = record.runCandles[run.id][run.cursor];
      run.monitoring = abortMonitoring(run.monitoring, plan, candle.close, nowIso(), strategyAbortInputSchema.parse(input).reason);
      run.controlStatus = "COMPLETED"; run.endedAt = nowIso();
    }
    updateRun(record, run);
    return updateRecord(record);
  });
}

export async function exportStrategy(id: string): Promise<object> {
  const record = await requiredRecord(id);
  const runAuditSchema = z.strictObject({
    runId: z.uuid(), observedSnapshotId: z.string().min(1), visibleCandles: z.array(candleSchema).min(1),
    events: z.array(monitoringEventSchema.extend({ runEventId: z.string().min(1), runId: z.uuid() })),
  });
  const runAudits = record.view.runs.map((run) => runAuditSchema.parse({
    runId: run.id, observedSnapshotId: run.observedSnapshotId,
    visibleCandles: visibleForRun(record, run),
    events: run.monitoring.events.map((event) => ({ ...event, runEventId: `${run.id}:${event.sequence}`, runId: run.id })),
  }));
  return { schemaVersion: "1", exportedAt: nowIso(), strategy: strategyViewSchema.parse(record.view), runAudits,
    schemas: { strategyPlan: z.toJSONSchema(strategyPlanSchema), strategyRun: z.toJSONSchema(strategyRunSchema),
      strategyView: z.toJSONSchema(strategyViewSchema), monitoringState: z.toJSONSchema(monitoringStateSchema),
      monitoringEvent: z.toJSONSchema(monitoringEventSchema), runAudit: z.toJSONSchema(runAuditSchema) },
    executionAssumptions: { side: "LONG", order: "buy-stop", quantity: 1, fees: 0, slippage: 0, gapFill: "open", intrabarAmbiguity: "INDETERMINATE" },
  };
}
