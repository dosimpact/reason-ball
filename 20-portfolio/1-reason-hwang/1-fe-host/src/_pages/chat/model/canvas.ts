export type CanvasRequest = { ticker: string; interval: "1d" | "1wk"; count: number; indicators?: unknown[] };
export type CanvasContext = { reportId?: string; request?: CanvasRequest };
export type CanvasEvent = { channel: "canvas"; type: "open" | "reset" | "delta" | "validating" | "ready" | "error"; reportId: string; payload: Record<string, unknown> };
export type CanvasReport = { id: string; threadId: string; runId: string; messageId: string; title: string; ordinal: number; request?: CanvasRequest; program: string; status: "generating" | "validating" | "ready" | "error"; asOf?: string; error?: string; fallbackText?: string; reactiveState?: Record<string, unknown>; successfulArgs?: Record<string, unknown> };
export type CanvasState = { reports: CanvasReport[]; selectedId: string | null; collapsed: boolean; closedIds: string[]; ordinals: Record<string, number> };
export const initialCanvas: CanvasState = { reports: [], selectedId: null, collapsed: false, closedIds: [], ordinals: {} };
export type CanvasAction = { type: "restore"; values: unknown; threadId: string; runId: string; messageId: string; running: boolean } | { type: "clear" } | { type: "select"; id: string } | { type: "collapse"; value: boolean } | { type: "close"; id: string } | { type: "state"; id: string; state: Record<string, unknown> } | { type: "query"; id: string; args: Record<string, unknown> } | { type: "finish"; runId: string; error?: string } | { type: "event"; threadId: string; runId: string; messageId: string; event: CanvasEvent };
export function parseCanvasEvent(value: unknown): CanvasEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (event.channel !== "canvas" || !["open", "reset", "delta", "validating", "ready", "error"].includes(String(event.type)) || typeof event.reportId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(event.reportId) || !event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) return null;
  return event as CanvasEvent;
}
export function reduceCanvas(state: CanvasState, action: CanvasAction): CanvasState {
  if (action.type === "restore") {
    if (!action.values || typeof action.values !== "object") return state;
    const saved = (action.values as Record<string, unknown>).canvas_reports;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return state;
    const reports = [...state.reports]; const ordinals = { ...state.ordinals };
    for (const [id, value] of Object.entries(saved)) {
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) || state.closedIds.includes(id) || !value || typeof value !== "object") continue;
      const source = value as Record<string, unknown>;
      const existing = reports.find(report => report.id === id);
      const request = source.request as CanvasRequest | undefined;
      const labelKey = `${request?.ticker}:${request?.interval}`;
      const ordinal = existing?.ordinal ?? (ordinals[labelKey] ?? 0) + 1;
      ordinals[labelKey] = Math.max(ordinals[labelKey] ?? 0, ordinal);
      const program = typeof source.program === "string" ? source.program : "";
      const valid = !!program.trim() && program.length <= 60000;
      const status = source.status === "ready" && valid ? "ready" : source.status === "error" || !action.running ? "error" : "generating";
      const analysis = source.analysis && typeof source.analysis === "object" ? source.analysis as Record<string, unknown> : {};
      const dates = Array.isArray(analysis.dates) ? analysis.dates : [];
      const report: CanvasReport = { ...existing, id, threadId: action.threadId, runId: action.runId, messageId: existing?.messageId ?? action.messageId,
        title: typeof source.title === "string" ? source.title : "복원된 기술적 분석", ordinal, request, program: valid ? program : "", status,
        asOf: typeof dates.at(-1) === "string" ? dates.at(-1) : undefined,
        error: status === "error" ? typeof source.error === "string" ? source.error : "완료된 보고서가 저장되지 않았습니다." : undefined,
        fallbackText: typeof source.fallbackText === "string" ? source.fallbackText : undefined };
      const index = reports.findIndex(item => item.id === id); if (index < 0) reports.push(report); else reports[index] = report;
    }
    return { ...state, reports, ordinals, selectedId: state.selectedId ?? reports.at(-1)?.id ?? null };
  }
  if (action.type === "clear") return initialCanvas;
  if (action.type === "collapse") return { ...state, collapsed: action.value };
  if (action.type === "select") return state.reports.some(report => report.id === action.id) ? { ...state, selectedId: action.id, collapsed: false } : state;
  if (action.type === "close") { const reports = state.reports.filter(report => report.id !== action.id); return { ...state, reports, closedIds: [...state.closedIds, action.id], selectedId: state.selectedId === action.id ? reports.at(-1)?.id ?? null : state.selectedId }; }
  if (action.type === "state") { const reactiveState = Object.fromEntries(Object.entries(action.state).filter(([key]) => key !== "$chart_refresh_seconds")); if (JSON.stringify(state.reports.find(report => report.id === action.id)?.reactiveState) === JSON.stringify(reactiveState)) return state; return { ...state, reports: state.reports.map(report => report.id === action.id ? { ...report, reactiveState } : report) }; }
  if (action.type === "query") return { ...state, reports: state.reports.map(report => report.id === action.id ? { ...report, successfulArgs: action.args } : report) };
  if (action.type === "finish") return { ...state, reports: state.reports.map(report => report.runId === action.runId && !["ready", "error"].includes(report.status) ? { ...report, status: "error", error: action.error ?? "완료된 보고서 없이 실행이 종료되었습니다." } : report) };
  const { event, threadId, runId, messageId } = action;
  if (state.closedIds.includes(event.reportId)) return state;
  const current = state.reports.find(report => report.id === event.reportId);
  if (event.type === "open") {
    if (current) return state;
    const request = event.payload.request as CanvasRequest | undefined;
    const labelKey = `${request?.ticker}:${request?.interval}`;
    const ordinal = (state.ordinals[labelKey] ?? 0) + 1;
    const report: CanvasReport = { id: event.reportId, threadId, runId, messageId, title: typeof event.payload.title === "string" ? event.payload.title : "기술적 분석", ordinal, request, program: "", status: "generating", asOf: typeof event.payload.asOf === "string" ? event.payload.asOf : undefined };
    return { ...state, reports: [...state.reports, report], selectedId: report.id, collapsed: false, ordinals: { ...state.ordinals, [labelKey]: ordinal } };
  }
  if (!current || current.runId !== runId || current.threadId !== threadId || ["ready", "error"].includes(current.status)) return state;
  const payload = event.payload;
  const report: CanvasReport = { ...current };
  if (event.type === "reset") { report.program = typeof payload.program === "string" ? payload.program.slice(0, 60000) : ""; report.status = "generating"; }
  if (event.type === "delta" && typeof payload.delta === "string") report.program = (report.program + payload.delta).slice(0, 60000);
  if (event.type === "validating") report.status = "validating";
  if (event.type === "ready" && typeof payload.program === "string" && payload.program.trim() && payload.program.length <= 60000) { report.program = payload.program; report.status = "ready"; report.request = payload.request as CanvasRequest ?? report.request; report.asOf = typeof payload.asOf === "string" ? payload.asOf : report.asOf; }
  if (event.type === "error") { report.status = "error"; report.error = typeof payload.message === "string" ? payload.message : "보고서를 생성하지 못했습니다."; report.fallbackText = typeof payload.fallbackText === "string" ? payload.fallbackText : undefined; }
  return { ...state, reports: state.reports.map(item => item.id === report.id ? report : item) };
}
