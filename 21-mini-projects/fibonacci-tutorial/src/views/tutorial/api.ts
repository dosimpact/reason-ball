import type { Catalog, SessionView } from "@/entities/tutorial";
import type { AnalysisPlan, LearningSubmission } from "@/entities/lesson";
import type { PlanInput } from "@/features/confirm-trade-plan";
import { request } from "@/shared/api/request";

export type SourceSelection = { type: "dummy" } | { type: "binance"; symbol: "BTCUSDT" | "ETHUSDT"; interval: "1h" | "4h" | "1d"; startTime?: number };
const sessionPath = (id: string) => `/api/sessions/${encodeURIComponent(id)}`;
const post = (path: string, body: object) => request<SessionView>(path, { method: "POST", body: JSON.stringify(body) });
export const tutorialApi = {
  catalog: () => request<Catalog>("/api/catalog"),
  createSession: (unitId: string, source?: SourceSelection) => post("/api/sessions", { unitId, ...(source ? { source } : {}) }),
  session: (id: string) => request<SessionView>(sessionPath(id)),
  advance: (id: string, expectedStep: number, direction: "next" | "prev" = "next") => post(`${sessionPath(id)}/advance`, { expectedStep, direction }),
  check: (id: string, waveIndices: number[]) => post(`${sessionPath(id)}/check`, { waveIndices }),
  hint: (id: string, kind: "hint" | "example") => post(`${sessionPath(id)}/hint`, { kind }),
  confirmPlan: (id: string, plan: PlanInput) => post(`${sessionPath(id)}/plan`, plan),
  revise: (id: string, expectedPlanId: string) => post(`${sessionPath(id)}/revise`, { expectedPlanId }),
  revealCandle: (id: string, expectedCursor: number) => post(`${sessionPath(id)}/replay`, { expectedCursor }),
  evaluate: (id: string) => post(`${sessionPath(id)}/evaluate`, {}),
  reflect: (id: string, input: { decision: "close" | "hold"; reason: string }) => post(`${sessionPath(id)}/reflection`, input),
  exportUrl: (id: string) => `${sessionPath(id)}/export`,
  checkLesson: (id: string, submission: LearningSubmission) => post(`${sessionPath(id)}/lesson/check`, submission),
  selectCase: (id: string, caseIndex: number) => post(`${sessionPath(id)}/lesson/case`, { caseIndex }),
  analysisPlan: (id: string, plan: AnalysisPlan) => post(`${sessionPath(id)}/analysis/plan`, plan),
  analysisRevise: (id: string, expectedPlanId: string) => post(`${sessionPath(id)}/analysis/revise`, { expectedPlanId }),
  analysisReplay: (id: string, expectedCursor: number) => post(`${sessionPath(id)}/analysis/replay`, { expectedCursor }),
  analysisEvaluate: (id: string) => post(`${sessionPath(id)}/analysis/evaluate`, {}),
  analysisReflection: (id: string, planId: string, reason: string) => post(`${sessionPath(id)}/analysis/reflection`, { planId, reason }),
  abortMonitoring: (id: string, expectedPlanId: string, expectedCursor: number, reason: string) => post(`${sessionPath(id)}/monitoring/abort`, { expectedPlanId, expectedCursor, reason }),
};
