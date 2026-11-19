import type { ViewerMetadata, ViewerFactPage } from "../model/types";
import { validFiling, factIdPattern } from "../model/types";
const base = `${process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") ?? ""}/api/remote-proxy/api/sec/filings`;
export class ViewerApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export function viewerBase(cik: string, accessionNo: string) { if (!validFiling(cik, accessionNo)) throw new Error("CIK와 접수번호 형식을 확인하세요."); return `${base}/${encodeURIComponent(cik.padStart(10, "0"))}/${encodeURIComponent(accessionNo)}`; }
async function get(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) { const body = await response.json().catch(() => null); throw new ViewerApiError(typeof body?.message === "string" ? body.message : `뷰어 요청 실패 (${response.status})`, response.status); }
  return response;
}
export async function loadViewer(cik: string, accessionNo: string, signal: AbortSignal): Promise<ViewerMetadata> {
  const data: ViewerMetadata = await (await get(`${viewerBase(cik, accessionNo)}/ixbrl`, signal)).json();
  if (!/^[a-f0-9]{64}$/i.test(data.sourceHash) || typeof data.extractorVersion !== "string") throw new Error("뷰어 문서 버전 정보가 올바르지 않습니다.");
  return data;
}
export async function loadDocument(cik: string, accessionNo: string, meta: ViewerMetadata, signal: AbortSignal) {
  const response = await get(`${viewerBase(cik, accessionNo)}/ixbrl/document?${new URLSearchParams({ sourceHash: meta.sourceHash })}`, signal);
  if (response.headers.get("x-source-hash") !== meta.sourceHash || response.headers.get("x-extractor-version") !== meta.extractorVersion) throw new Error("문서 버전이 변경되었습니다. 다시 불러오세요.");
  return response.text();
}
export async function loadFacts(cik: string, accessionNo: string, meta: ViewerMetadata, filters: { q?: string; page?: number; factId?: string }, signal: AbortSignal): Promise<ViewerFactPage> {
  if (filters.factId && !factIdPattern.test(filters.factId)) throw new Error("올바르지 않은 fact ID입니다.");
  const query = new URLSearchParams({ sourceHash: meta.sourceHash, page: String(filters.page ?? 1) });
  if (filters.factId) query.set("factId", filters.factId); else if (filters.q) query.set("q", filters.q);
  const data: ViewerFactPage = await (await get(`${viewerBase(cik, accessionNo)}/ixbrl/facts?${query}`, signal)).json();
  if (data.sourceHash !== meta.sourceHash || data.extractorVersion !== meta.extractorVersion) throw new Error("검색 결과와 문서 버전이 다릅니다. 다시 불러오세요.");
  return data;
}
