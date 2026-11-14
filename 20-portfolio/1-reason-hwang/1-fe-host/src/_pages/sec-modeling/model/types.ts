export type Stage = 1 | 2 | 3;
export type ExtractionModel = "gpt-5.6-sol" | "gpt-5.6-luna";
export interface ModelingRun {
  id: string; runId: string; cik: string; accessionNo: string; stage: Stage;
  status: string; error?: unknown; createdAt: string; finishedAt?: string;
  config?: Record<string, unknown>; workUnits?: Record<string, unknown>[];
  outputGenerationId?: string;
}
export interface ModelingFiling {
  cik: string; accessionNo: string; companyName: string; ticker: string;
  formType: string; reportDate: string; filingDate: string; hasSource: boolean;
  stages: Record<string, { status: string; latestRun?: ModelingRun; generationId?: string; resultCount?: number; readiness?: string; stale?: boolean }>;
}
export interface ModelingEvent { id: string; type: string; payload: unknown; createdAt: string }
export interface ResultPage { items: Record<string, unknown>[]; total?: number; page?: number; pageSize?: number; generationId?: string }
export const stages: Stage[] = [1, 2, 3];
export const stageNames = { 1: "문서 구조", 2: "본문 검색·근거", 3: "SEC 도메인 지식" };
export function isActive(status?: string) { return status === "QUEUED" || status === "RUNNING"; }
export function filingPath(filing: Pick<ModelingFiling, "cik" | "accessionNo">) {
  return `filings/${encodeURIComponent(filing.cik)}/${encodeURIComponent(filing.accessionNo)}`;
}
export function canStart(filing: ModelingFiling, stage: Stage) {
  if (isActive(filing.stages[String(stage)]?.latestRun?.status)) return false;
  return stage === 2 ? Boolean(filing.stages["1"]?.generationId) && filing.stages["1"]?.readiness !== "stale" : filing.hasSource;
}

export function mergeEvents(previous: ModelingEvent[], incoming: ModelingEvent[]) {
  return [...new Map([...previous, ...incoming].map(event => [event.id, event])).values()];
}
