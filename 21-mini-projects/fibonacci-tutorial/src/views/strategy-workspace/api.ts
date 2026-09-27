import type { StrategyConfirmInput, StrategyDraftInput, StrategyMode, StrategySource, StrategySummary, StrategyView } from "@/entities/strategy";
import { request } from "@/shared/api/request";

const strategyPath = (id: string) => `/api/strategies/${encodeURIComponent(id)}`;
const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export const strategyApi = {
  list: () => request<{ strategies: StrategySummary[] }>("/api/strategies"),
  options: () => request<{ dummyCutoffs: Array<{ index: number; ordinal: number; asOf: number; maxBacktestBars: number }> }>("/api/strategies/options"),
  create: (input: StrategyDraftInput) => request<StrategyView>("/api/strategies", json(input)),
  get: (id: string) => request<StrategyView>(strategyPath(id)),
  update: (id: string, input: { expectedVersion: number; title?: string; asOf?: number; refreshData?: boolean; draftPlan?: StrategyView["draftPlan"] }) => request<StrategyView>(strategyPath(id), { method: "PATCH", body: JSON.stringify(input) }),
  confirm: (id: string, input: StrategyConfirmInput) => request<StrategyView>(`${strategyPath(id)}/confirm`, json(input)),
  revise: (id: string, input: { expectedVersion: number; mode?: StrategyMode; source?: StrategySource; asOf?: number }) => request<StrategyView>(`${strategyPath(id)}/revise`, json(input)),
  startRun: (id: string, expectedVersion: number, mode: StrategyMode) => request<StrategyView>(`${strategyPath(id)}/runs`, json({ expectedVersion, mode })),
  runAction: (id: string, runId: string, action: "step" | "batch" | "poll" | "pause" | "resume", expectedVersion: number) => request<StrategyView>(`${strategyPath(id)}/runs/${encodeURIComponent(runId)}/${action}`, json({ expectedVersion })),
  abort: (id: string, runId: string, expectedVersion: number, reason: string) => request<StrategyView>(`${strategyPath(id)}/runs/${encodeURIComponent(runId)}/abort`, json({ expectedVersion, reason })),
  export: (id: string) => request<unknown>(`${strategyPath(id)}/export`),
};
