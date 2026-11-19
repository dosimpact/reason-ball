import type { Company } from "../model/history";

export type FailureStage = "resolve" | "prepare" | "chat" | "collect";
export type FailureReply = { reply: string; source: "model" | "fallback" };
export type FailureReason = "filing_not_ready" | "filing_not_found" | "session_expired" | "connection_failed" | "invalid_response" | "unknown";
export type FailureContext = { stage: FailureStage; company?: Company; reason?: FailureReason };
export function failureReason(error: unknown): FailureReason {
  const message = error instanceof Error ? error.message : "";
  if (/세션이 만료/.test(message)) return "session_expired";
  if (/최신.*다운로드.*완료되지/.test(message)) return "filing_not_ready";
  if (/저장된 10-K가 없습니다|해당 기업의 10-K가 없습니다/.test(message)) return "filing_not_found";
  if (/형식.*검증|응답 형식|완료.*전에 연결이 끊/.test(message)) return "invalid_response";
  if (/연결|Failed to fetch|NetworkError/.test(message)) return "connection_failed";
  return "unknown";
}
const fallbackReplies: Record<FailureStage, string> = {
  resolve: "요청을 해석하는 중 문제가 생겨 답변을 완성하지 못했어요. 기업명과 궁금한 내용을 다시 보내 주세요.",
  prepare: "분석에 필요한 10-K 원문을 준비하지 못했어요. 아직 원문에 근거한 분석을 완료하지 않았습니다. 잠시 후 같은 질문을 다시 보내 주세요.",
  chat: "공시를 분석하는 중 문제가 생겨 답변을 완성하지 못했어요. 확인되지 않은 분석 결과는 제공하지 않겠습니다. 같은 질문을 다시 보내 주세요.",
  collect: "공시 수집 결과를 확인하지 못했어요. 수집이 완료되었다고 말씀드릴 수 없습니다. 수집 상태를 확인하거나 잠시 후 다시 요청해 주세요.",
};

export async function requestFailureReply(message: string, context: FailureContext, signal: AbortSignal): Promise<FailureReply> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("/api/sec-chat/failure-reply", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ message: message.trim().slice(0, 4000), stage: context.stage, reason: context.reason ?? "unknown",
        ...(context.company ? { company: { cik: context.company.cik, name: context.company.name, ticker: context.company.ticker } } : {}) }),
    });
    if (!response.ok) throw new Error("Failure reply unavailable");
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("reply" in value) || typeof value.reply !== "string" || !value.reply.trim() || value.reply.length > 2500 || !("source" in value) || (value.source !== "model" && value.source !== "fallback")) throw new Error("Invalid failure reply");
    signal.throwIfAborted();
    return { reply: value.reply.trim(), source: value.source };
  } catch {
    signal.throwIfAborted();
    return { reply: fallbackReplies[context.stage], source: "fallback" };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}
