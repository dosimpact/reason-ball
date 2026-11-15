export type DartField = { key: string; label: string; type: string; value?: string; enabled?: boolean; required?: boolean };
export type DartPreset = { id: string; label: string; path: string; zip: boolean; fields: DartField[] };
const corpCode: DartField = { key: "corp_code", label: "고유번호", type: "8자리 숫자", value: "00126380", enabled: true, required: true };
export const dartPresets: DartPreset[] = [
  { id: "corporations", label: "고유번호 파일", path: "corpCode.xml", zip: true, fields: [] },
  { id: "filings", label: "공시 검색", path: "list.json", zip: false, fields: [
    { ...corpCode, enabled: false, required: false },
    { key: "bgn_de", label: "시작일", type: "YYYYMMDD" }, { key: "end_de", label: "종료일", type: "YYYYMMDD" },
    { key: "last_reprt_at", label: "최종보고서만", type: "Y / N", value: "N" },
    { key: "pblntf_ty", label: "공시 유형", type: "A~J" }, { key: "pblntf_detail_ty", label: "공시 상세 유형", type: "예: A001" },
    { key: "corp_cls", label: "법인 구분", type: "Y / K / N / E" },
    { key: "sort", label: "정렬 기준", type: "date / crp / rpt", value: "date" }, { key: "sort_mth", label: "정렬 방향", type: "asc / desc", value: "desc" },
    { key: "page_no", label: "페이지", type: "정수", value: "1", enabled: true }, { key: "page_count", label: "페이지당 건수", type: "1~100", value: "10", enabled: true },
  ] },
  { id: "document", label: "공시 원문 파일", path: "document.xml", zip: true, fields: [{ key: "rcept_no", label: "접수번호", type: "14자리 숫자", enabled: true, required: true }] },
  { id: "company", label: "기업 개황", path: "company.json", zip: false, fields: [{ ...corpCode }] },
  { id: "financials", label: "단일회사 전체 재무제표", path: "fnlttSinglAcntAll.json", zip: false, fields: [
    { ...corpCode }, { key: "bsns_year", label: "사업연도", type: "YYYY", value: "2025", enabled: true, required: true },
    { key: "reprt_code", label: "보고서 코드", type: "11011 사업 / 11012 반기 / 11013 1분기 / 11014 3분기", value: "11011", enabled: true, required: true },
    { key: "fs_div", label: "재무제표 구분", type: "CFS 연결 / OFS 별도", value: "CFS", enabled: true, required: true },
  ] },
];
export const dartProxyBase = `${process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") ?? ""}/api/remote-proxy/api/dart/`;
export type DartRequest = { method: "GET"; url: string; headers: Record<string, string> };
export type DartResult = { request: DartRequest; status: number | null; statusText: string; durationMs: number; headers: Record<string, string>; outcome: "success" | "http-error" | "network-error" | "aborted" | "format-error"; bodyText: string; json?: unknown; truncated?: boolean; error?: string; file?: { blob: Blob; filename: string; size: number } };
export function buildDartRequest(presetId: string, values: Record<string, string>): DartRequest {
  const preset = dartPresets.find(item => item.id === presetId);
  if (!preset) throw new Error("지원하지 않는 DART API입니다.");
  if (Object.keys(values).some(key => !preset.fields.some(field => field.key === key))) throw new Error("허용되지 않는 요청 인자입니다.");
  const query = new URLSearchParams(values);
  return { method: "GET", url: `${dartProxyBase}${preset.path}${query.size ? `?${query}` : ""}`, headers: { Accept: preset.zip ? "application/zip, application/json" : "application/json" } };
}
