export type Stage = 1 | 2 | 3;
export type ExtractionModel = "gpt-5.6-sol" | "gpt-5.6-luna" | "gpt-6-luna";
export interface ModelingRun {
  id: string; runId: string; cik: string; accessionNo: string; stage: Stage;
  status: string; error?: unknown; createdAt: string; finishedAt?: string;
  config?: Record<string, unknown>; workUnits?: Record<string, unknown>[];
  outputGenerationId?: string;
}
export interface ModelingFiling {
  cik: string; accessionNo: string; companyName: string; ticker: string;
  formType: string; reportDate: string; filingDate: string; hasSource: boolean; serviceError?: string;
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
export function startBlockReason(filing: ModelingFiling, stage: Stage): string | null {
  if (!(stage === 3 ? ["10-K", "10-Q"] : ["10-K", "10-K/A"]).includes(filing.formType)) return "지원하지 않는 공시 양식입니다.";
  if (isActive(filing.stages[String(stage)]?.latestRun?.status) || isActive(filing.stages[String(stage)]?.status)) return "이 단계의 작업이 이미 실행 중입니다.";
  if (!filing.hasSource) return "수집된 원문이 필요합니다. SEC 수집 관리에서 원문을 저장하세요.";
  const prior = filing.stages["1"];
  if (stage === 2 && (!prior?.generationId || prior.readiness === "stale" || prior.status === "unavailable" || prior.readiness === "unavailable")) return "모델링 1의 현재 원문과 일치하는 게시 결과가 필요합니다.";
  return null;
}
export function canStart(filing: ModelingFiling, stage: Stage) { return !startBlockReason(filing, stage); }


export function mergeEvents(previous: ModelingEvent[], incoming: ModelingEvent[]) {
  return [...new Map([...previous, ...incoming].map(event => [event.id, event])).values()];
}

export type ModelingFilters = { cik: string; q: string; formType: string; sourceStatus: "all" | "collected" | "missing" };
export const initialModelingFilters: ModelingFilters = { cik: "", q: "", formType: "", sourceStatus: "all" };
export type ModelingStageCounts = { supported: number; unsupported: number; latestRuns: { QUEUED: number; RUNNING: number; SUCCEEDED: number; FAILED: number; CANCELLED: number; unprocessed: number } };
export type ModelingOverview = { scope: "filtered"; filters: Record<string, unknown>; totalFilings: number; sourceCollected: number; sourceMissing: number; stages: Record<string, ModelingStageCounts>; retrievedAt: string };
export function modelingFilterQuery(filters: ModelingFilters) {
  return new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")));
}
export const statusLabel = (status?: string) => ({ QUEUED: "대기", RUNNING: "실행 중", SUCCEEDED: "성공", FAILED: "실패", CANCELLED: "취소", ready: "게시됨", unprocessed: "미처리", UNPROCESSED: "미처리", input_required: "입력 필요", stale: "재처리 필요", unsupported: "미지원", unavailable: "게시 상태 확인 불가" }[status ?? ""] ?? status ?? "미처리");
