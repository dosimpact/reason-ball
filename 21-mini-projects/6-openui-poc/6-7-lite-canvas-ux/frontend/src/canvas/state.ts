export type Quote = { reportId: string; text: string };
export type Report = {
  id: string; title: string; vendor: string; source_file: string; program: string;
  status: "generating" | "validating" | "reviewing" | "repairing" | "ready" | "error";
  report_mode?: "interactive" | "pdf";
  published: boolean; created_at: string; error?: string;
};
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; format?: "text" | "openui"; status?: "streaming" | "ready" | "error"; quote?: Quote | null };
export type Thread = { id: string; title: string; messages: ChatMessage[] };
export type CanvasEvent = { channel: string; type: string; reportId?: string; report?: Report; delta?: string; message?: string; content?: string; messageId?: string; target?: string; format?: "text" | "openui" };

// open만 리포트를 교체합니다. 이후에는 현재 ID의 이벤트만 반영하여 이전 생성 결과의 혼입을 막습니다.
export function reduceReport(current: Report | null, event: CanvasEvent): Report | null {
  if (event.type === "open" && event.report) return event.report;
  if (!current) return current;
  if (event.reportId && event.reportId !== current.id) return current;
  if (event.type === "ready" && event.report) return event.report.id === current.id ? event.report : current;
  if (event.type === "TEXT_MESSAGE_START") return { ...current, program: "", status: "generating" };
  if (event.type === "TEXT_MESSAGE_CONTENT") return { ...current, program: current.program + (event.delta ?? "") };
  if (event.type === "validating" || event.type === "reviewing" || event.type === "repairing") return { ...current, status: event.type };
  if (event.type === "error") return { ...current, status: "error", error: event.message };
  return current;
}

// messageId별로 스트림을 누적합니다. 수정 시 START가 같은 메시지를 교체하여 실패한 초안이 남지 않습니다.
export function reduceChat(messages: ChatMessage[], event: CanvasEvent): ChatMessage[] {
  const id = event.messageId ?? `summary-${messages.length}`;
  if (event.type === "TEXT_MESSAGE_START" || event.type === "message") {
    const message: ChatMessage = { id, role: "assistant", content: event.content ?? "", format: event.format ?? "text", status: event.type === "message" ? "ready" : "streaming" };
    return messages.some(m => m.id === id) ? messages.map(m => m.id === id ? message : m) : [...messages, message];
  }
  if (event.type === "TEXT_MESSAGE_CONTENT") return messages.map(m => m.id === id ? { ...m, content: m.content + (event.delta ?? "") } : m);
  if (event.type === "TEXT_MESSAGE_END") return messages.map(m => m.id === id ? { ...m, status: "ready" } : m);
  if (event.type === "UI_ERROR") return messages.map(m => m.id === id ? { ...m, status: "error", content: event.message ?? "UI 생성 실패" } : m);
  return messages;
}
