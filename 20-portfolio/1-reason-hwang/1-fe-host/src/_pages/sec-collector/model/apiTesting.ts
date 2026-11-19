import { secApiUrl } from "../api/secCollectorApi";

export type QueryField = { key: string; type: "string" | "number" | "boolean"; defaultValue?: string; enabled?: boolean };
export type ApiTestPreset = { id: string; label: string; method: "GET" | "POST"; path: string; queryFields: QueryField[]; defaultBody?: string; pathParams?: string[]; streaming?: boolean; mutating: boolean };
const pagination: QueryField[] = [{ key: "page", type: "number", defaultValue: "1", enabled: true }, { key: "pageSize", type: "number", defaultValue: "10", enabled: true }];
export const apiTestPresets: ApiTestPreset[] = [
  { id: "companies", label: "기업 목록", method: "GET", path: "companies", mutating: false, queryFields: [...pagination, ...["cik", "ticker", "q"].map(key => ({ key, type: "string" as const }))] },
  { id: "filings", label: "공시 목록", method: "GET", path: "filings", mutating: false, queryFields: [...pagination, ...["cik", "ticker", "since", "formType", "status", "parserStatus"].map(key => ({ key, type: "string" as const })), ...["includeContent", "includeAmendments", "includeFormerRegistrants"].map(key => ({ key, type: "boolean" as const, defaultValue: "false", enabled: true }))] },
  { id: "content", label: "저장 원문", method: "GET", path: "filings/:cik/:accessionNo/content", mutating: false, queryFields: [], pathParams: ["cik", "accessionNo"] },
  { id: "company-sync", label: "기업 목록 동기화", method: "POST", path: "company-sync-jobs", mutating: true, queryFields: [] },
  { id: "selected-sync", label: "선택 기업 수집", method: "POST", path: "company-filing-sync-jobs", streaming: true, mutating: true, queryFields: [], defaultBody: JSON.stringify({ tickers: ["AAPL"], years: 20, downloadDocuments: true, refreshArchive: false }, null, 2) },
  { id: "all-sync", label: "전체 기업 수집", method: "POST", path: "all-company-filing-sync-jobs", streaming: true, mutating: true, queryFields: [], defaultBody: JSON.stringify({ years: 20, downloadDocuments: true, refreshArchive: false }, null, 2) },
];
export type TestRequest = { method: "GET" | "POST"; url: string; headers: Record<string, string>; body?: string };
export type TestStreamEvent = { type: string; data: unknown };
export type TestResult = { request: TestRequest; status: number | null; statusText: string; durationMs: number; headers: Record<string, string>; bodyText: string; body?: unknown; events: TestStreamEvent[]; outcome: "success" | "http-error" | "sse-error" | "partial" | "disconnected" | "network-error" | "aborted"; error?: string; truncated?: boolean };

export function buildTestRequest(input: { presetId: string; query: Record<string, string>; bodyText: string; cik?: string; accessionNo?: string }): TestRequest {
  const preset = apiTestPresets.find(item => item.id === input.presetId);
  if (!preset) throw new Error("지원하지 않는 SEC API입니다.");
  let path = preset.path;
  if (preset.pathParams) {
    if (!/^\d{1,10}$/.test(input.cik ?? "") || !/^\d{10}-\d{2}-\d{6}$/.test(input.accessionNo ?? "")) throw new Error("CIK와 접수번호 형식을 확인하세요.");
    path = path.replace(":cik", encodeURIComponent(input.cik!)).replace(":accessionNo", encodeURIComponent(input.accessionNo!));
  }
  const url = secApiUrl(path);
  const query = new URLSearchParams(input.query);
  const headers: Record<string, string> = { Accept: preset.streaming ? "text/event-stream" : preset.id === "content" ? "text/html, application/xml, text/plain, application/json" : "application/json" };
  let body: string | undefined;
  if (preset.method === "POST" && input.bodyText.trim()) { JSON.parse(input.bodyText); body = input.bodyText; headers["Content-Type"] = "application/json"; }
  return { method: preset.method, url: `${url}${query.size ? `?${query}` : ""}`, headers, ...(body !== undefined ? { body } : {}) };
}

export function assertAllowedTestRequest(request: TestRequest) {
  const parsed = new URL(request.url, "http://sec-testing.invalid");
  if (parsed.origin !== "http://sec-testing.invalid" || !request.url.startsWith("/")) throw new Error("SEC 프록시 경로만 사용할 수 있습니다.");
  const prefix = secApiUrl("");
  if (!parsed.pathname.startsWith(prefix)) throw new Error("SEC 프록시 경로만 사용할 수 있습니다.");
  const path = parsed.pathname.slice(prefix.length);
  const preset = apiTestPresets.find(item => item.method === request.method && item.path === path);
  const content = request.method === "GET" && /^filings\/\d{1,10}\/\d{10}-\d{2}-\d{6}\/content$/.test(path);
  if (!preset && !content) throw new Error("허용된 SEC API만 실행할 수 있습니다.");
  if (Object.keys(request.headers).some(key => !["accept", "content-type"].includes(key.toLowerCase()))) throw new Error("지원하지 않는 요청 헤더입니다.");
}
