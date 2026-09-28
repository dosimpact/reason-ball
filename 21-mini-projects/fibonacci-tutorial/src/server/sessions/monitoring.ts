import "server-only";
import { randomUUID } from "node:crypto";
import { abortMonitoring, advanceMonitoring, createMonitoringState, type MonitoringState } from "@/entities/strategy-monitor";
import type { SessionView } from "@/entities/tutorial";
import type { TradePlan } from "@/entities/trade-plan";
import { readSession, serializeMutation, writeSession, type SessionRecord } from "./repository";
import { SessionError } from "./service";

function observedAt(candleTime: number): string {
  return new Date(candleTime * 1000).toISOString();
}

export function monitoringHistoryWith(history: MonitoringState[], state: MonitoringState): MonitoringState[] {
  const index = history.findIndex((item) => item.planId === state.planId);
  if (index < 0) return [...history, state];
  return history.map((item, position) => position === index ? state : item);
}

export function restoreMonitoring(record: SessionRecord): MonitoringState | null {
  const session = record.view;
  const plan = session.plan;
  if (!plan) return null;
  if (session.monitoring?.planId === plan.id) return session.monitoring;
  const historical = session.monitoringHistory.find((item) => item.planId === plan.id);
  if (historical) return historical;
  const asOfClose = session.visibleCandles.find((bar) => bar.time === plan.asOf)?.close
    ?? record.snapshot.candles.find((bar) => bar.time === plan.asOf)?.close;
  let state = createMonitoringState(plan, plan.createdAt, asOfClose);
  const observed = session.visibleCandles.filter((bar) => bar.time > plan.asOf);
  for (const [index, candle] of observed.entries()) {
    state = advanceMonitoring(state, plan, candle, observedAt(candle.time), session.complete && index === observed.length - 1 && session.source.type === "dummy");
  }
  return state;
}

export function viewWithRestoredMonitoring(record: SessionRecord): SessionView {
  const monitoring = restoreMonitoring(record);
  if (!monitoring) return record.view;
  return { ...record.view, monitoring, monitoringHistory: monitoringHistoryWith(record.view.monitoringHistory, monitoring) };
}

export function monitorNextCandle(session: SessionView, plan: TradePlan, candle: SessionView["visibleCandles"][number], isFinal: boolean): MonitoringState {
  const current = session.monitoring?.planId === plan.id ? session.monitoring : session.monitoringHistory.find((item) => item.planId === plan.id);
  if (!current) throw new SessionError(409, "CONFLICT", "Monitoring state is missing for the active plan.");
  return advanceMonitoring(current, plan, candle, new Date().toISOString(), isFinal);
}

export function monitorLaterCandles(session: SessionView, plan: TradePlan, observed: SessionView["visibleCandles"]): MonitoringState {
  const current = session.monitoring?.planId === plan.id ? session.monitoring : session.monitoringHistory.find((item) => item.planId === plan.id);
  if (!current) throw new SessionError(409, "CONFLICT", "Monitoring state is missing for the active plan.");
  let state = current;
  for (const candle of observed) state = advanceMonitoring(state, plan, candle, new Date().toISOString());
  return state;
}

export function monitoringSummary(state: MonitoringState): string {
  const recent = state.events.at(-1);
  return `${state.status} · ${state.health} · ${recent?.kind ?? "PLAN_LOADED"}: ${recent?.reason ?? "No observation yet."}`;
}

export function abortSessionMonitoring(id: string, input: { expectedPlanId: string; expectedCursor: number; reason: string }): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const session = record.view;
    if (!session.plan || session.plan.id !== input.expectedPlanId || session.cursor !== input.expectedCursor) {
      throw new SessionError(409, "CONFLICT", "Plan or cursor is stale.");
    }
    const current = restoreMonitoring(record);
    if (!current) throw new SessionError(409, "CONFLICT", "Confirm a plan before stopping monitoring.");
    const lastClose = session.visibleCandles.at(-1)?.close;
    if (lastClose === undefined) throw new SessionError(409, "CONFLICT", "No public closing price is available.");
    let monitoring: MonitoringState;
    try { monitoring = abortMonitoring(current, session.plan, lastClose, new Date().toISOString(), input.reason); }
    catch (error) { throw new SessionError(409, "CONFLICT", error instanceof Error ? error.message : "Monitoring is already terminal."); }
    const summary = monitoringSummary(monitoring);
    const previousEvaluation = session.evaluations.filter((item) => item.planId === session.plan!.id).at(-1);
    const abortEvaluation = previousEvaluation ? {
      ...previousEvaluation,
      id: randomUUID(),
      evaluatedAt: new Date().toISOString(),
      monitoringSummary: summary,
      feedback: [
        ...previousEvaluation.feedback.filter((item) => item.rule !== "strategy-monitor"),
        { rule: "strategy-monitor", pass: true, reason: summary },
      ],
    } : null;
    const updated: SessionView = { ...session, monitoring, monitoringHistory: monitoringHistoryWith(session.monitoringHistory, monitoring),
      evaluations: abortEvaluation ? [...session.evaluations, abortEvaluation] : session.evaluations };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}
