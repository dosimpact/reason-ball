import type { InspectedRequest } from "@/shared/api";
export type ModelingPreset = { id: string; label: string; method: "GET" | "POST"; path: string; query: Record<string, string>; pathParams?: string[]; body?: string; mutating?: boolean };
const pages = { limit: "20", offset: "0" };
const filters = { cik: "", q: "", formType: "", sourceStatus: "all" };
const filingId = "filing:0000320193:0000320193-26-000001";
export const modelingPresets: ModelingPreset[] = [
  { id: "overview", label: "필터 범위 통계", method: "GET", path: "overview", query: filters },
  { id: "filings", label: "공시별 상태 목록", method: "GET", path: "filings", query: { ...pages, ...filters } },
  { id: "runs", label: "실행 이력 목록", method: "GET", path: "runs", query: { ...pages, cik: "", accessionNo: "" } },
  { id: "run", label: "실행 상세", method: "GET", path: "runs/:runId", query: {}, pathParams: ["runId"] },
  { id: "events", label: "실행 이벤트 페이지 · JSON", method: "GET", path: "runs/:runId/events", query: { cursor: "0" }, pathParams: ["runId"] },
  { id: "status", label: "현재 게시 상태", method: "GET", path: "filings/:cik/:accessionNo/status", query: {}, pathParams: ["cik", "accessionNo"] },
  { id: "results", label: "단계별 게시 결과", method: "GET", path: "filings/:cik/:accessionNo/results/:stage", query: pages, pathParams: ["cik", "accessionNo", "stage"] },
  ...([1, 2, 3] as const).map(stage => ({ id: `create-${stage}`, label: `모델링 ${stage} 실행 접수`, method: "POST" as const, path: `filings/:cik/:accessionNo/model-${stage}/runs`, query: {}, pathParams: ["cik", "accessionNo"], mutating: true, body: JSON.stringify(stage === 3 ? {} : { extractionModel: "gpt-5.6-sol" }, null, 2) })),
  { id: "cancel", label: "서버 실행 취소 요청", method: "POST", path: "runs/:runId/cancel", query: {}, pathParams: ["runId"], mutating: true, body: "{}" },
  { id: "retry", label: "실패·취소 작업 재시도 접수", method: "POST", path: "runs/:runId/retry", query: {}, pathParams: ["runId"], mutating: true, body: "{}" },
  { id: "search", label: "공시 근거 검색", method: "POST", path: "search", query: {}, body: JSON.stringify({ query: "주요 사업 위험", filingIds: [filingId], topK: 10 }, null, 2) },
  { id: "facts", label: "모델링 3 사실 조회", method: "POST", path: "facts/query", query: {}, body: JSON.stringify({ filingIds: [filingId], offset: 0, limit: 20 }, null, 2) },
  { id: "evidence", label: "검색 근거 상세", method: "GET", path: "evidence/:evidenceId", query: {}, pathParams: ["evidenceId"] },
];
const prefix = `${process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") ?? ""}/api/remote-proxy/api/sec/modeling/`;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const unsafeIdentifier = (value: string) => [".", ".."].includes(value) || ["/", "\\", "%"].some(character => value.includes(character)) || [...value].some(character => character.charCodeAt(0) < 32);
export function buildModelingTestRequest(input: { presetId: string; query: Record<string, string>; params: Record<string, string>; body: string }): InspectedRequest {
  const preset = modelingPresets.find(item => item.id === input.presetId);
  if (!preset) throw new Error("지원하지 않는 모델링 API입니다.");
  let path = preset.path;
  for (const key of preset.pathParams ?? []) {
    const value = input.params[key]?.trim() ?? "";
    if (!value || value.length > 512 || unsafeIdentifier(value) || (key === "cik" && !/^\d{1,10}$/.test(value)) || (key === "accessionNo" && !/^\d{10}-\d{2}-\d{6}$/.test(value)) || (key === "runId" && !uuid.test(value)) || (key === "stage" && !/^\d{1,3}$/.test(value))) throw new Error(`${key} 경로 값을 확인하세요.`);
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }
  const query = new URLSearchParams(input.query);
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string | undefined;
  if (preset.method === "POST" && input.body.trim()) { JSON.parse(input.body); body = input.body; headers["Content-Type"] = "application/json"; }
  return { method: preset.method, url: `${prefix}${path}${query.size ? `?${query}` : ""}`, headers, ...(body !== undefined ? { body } : {}) };
}
export function assertModelingTestRequest(request: InspectedRequest) {
  const url = new URL(request.url, "http://modeling-test.invalid");
  if (url.origin !== "http://modeling-test.invalid" || !request.url.startsWith(prefix)) throw new Error("동일 출처의 모델링 프록시만 사용할 수 있습니다.");
  const path = url.pathname.slice(prefix.length);
  const allowed = modelingPresets.some(preset => preset.method === request.method && new RegExp(`^${preset.path.replace(/:[a-zA-Z]+/g, token => token === ":cik" ? "\\d{1,10}" : token === ":accessionNo" ? "\\d{10}-\\d{2}-\\d{6}" : token === ":runId" ? "[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}" : token === ":stage" ? "\\d{1,3}" : "[^/]+")}$`).test(path));
  if (!allowed || path.split("/").some(part => { const decoded = decodeURIComponent(part); return unsafeIdentifier(decoded); }) || Object.keys(request.headers).some(key => !["accept", "content-type"].includes(key.toLowerCase()))) throw new Error("허용된 모델링 API 요청만 실행할 수 있습니다.");
}
