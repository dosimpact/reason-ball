import type { CompaniesFilters, Company, CompanyListResponse, CompanySyncResult, Filing, FilingsFilters, ListResponse, Overview, TraceListener } from "../model/types";

const base = `${process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") ?? ""}/api/remote-proxy/api/sec`;
export function secApiUrl(path: string, filters: Record<string, unknown> = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && (value !== "" || key === "parserStatus")) query.set(key, String(value)); });
  return `${base}/${path}${query.size ? `?${query}` : ""}`;
}

export async function requestSec(path: string, init: RequestInit, onTrace?: TraceListener) {
  const started = performance.now();
  const response = await fetch(path, { ...init, cache: "no-store" });
  onTrace?.({ method: init.method ?? "GET", url: path, status: response.status, durationMs: Math.round(performance.now() - started) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.message === "string" ? body.message : Array.isArray(body?.message) ? body.message.join("; ") : `SEC API 요청 실패 (${response.status})`);
  }
  return response;
}
export async function fetchCompanies(filters: CompaniesFilters, signal?: AbortSignal, onTrace?: TraceListener): Promise<CompanyListResponse<Company>> {
  return (await requestSec(secApiUrl("companies", filters), { signal }, onTrace)).json();
}
export async function fetchFilings(filters: FilingsFilters, signal?: AbortSignal, onTrace?: TraceListener): Promise<ListResponse<Filing>> {
  if (filters.includeFormerRegistrants && !filters.cik?.trim()) throw new Error("이전 법인 조회에는 CIK가 필요합니다.");
  return (await requestSec(secApiUrl("filings", { includeContent: false, includeAmendments: false, ...filters }), { signal }, onTrace)).json();
}
export async function syncCompanies(signal?: AbortSignal, onTrace?: TraceListener): Promise<CompanySyncResult> {
  return (await requestSec(secApiUrl("company-sync-jobs"), { method: "POST", signal }, onTrace)).json();
}
export async function fetchOverview(signal?: AbortSignal, onTrace?: TraceListener): Promise<Overview> {
  return (await requestSec(secApiUrl("overview"), { signal }, onTrace)).json();
}
export function filingContentUrl(cik: string, accessionNo: string) {
  return secApiUrl(`filings/${encodeURIComponent(cik)}/${encodeURIComponent(accessionNo)}/content`);
}
