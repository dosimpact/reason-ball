import { buildCollectionInput } from "../model/collectionInput";
import type { CollectionEvent, CollectionInput, CollectionKind, CollectionOutcome, TraceListener } from "../model/types";
import { requestSec, secApiUrl } from "./secCollectorApi";

function decodeEvent(frame: string): CollectionEvent | null {
  let type = "message";
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (!["started", "progress", "completed", "error"].includes(type) || !data.length) return null;
  const value: unknown = JSON.parse(data.join("\n"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("잘못된 수집 이벤트입니다.");
  return { type: type as CollectionEvent["type"], data: value as Record<string, unknown> };
}

export async function streamCollection(kind: CollectionKind, input: CollectionInput, onEvent: (event: CollectionEvent) => void, signal?: AbortSignal, onTrace?: TraceListener): Promise<CollectionOutcome> {
  const body = buildCollectionInput(kind, input);
  const path = kind === "selected" ? "company-filing-sync-jobs" : "all-company-filing-sync-jobs";
  const response = await requestSec(secApiUrl(path), { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, signal }, onTrace);
  if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) throw new Error("수집 이벤트 스트림이 없습니다.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal: CollectionOutcome | undefined;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (!terminal) {
      if (signal?.aborted) throw new DOMException("수집 연결 종료", "AbortError");
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const event = decodeEvent(frame);
        if (!event) continue;
        onEvent(event);
        if (event.type === "completed") terminal = { status: Number(event.data.failed ?? 0) > 0 ? "partial" : "completed", result: event.data };
        if (event.type === "error") terminal = { status: "error", result: event.data, message: String(event.data.message ?? "수집에 실패했습니다.") };
        if (terminal) break;
      }
      if (done) break;
    }
    if (signal?.aborted) throw new DOMException("수집 연결 종료", "AbortError");
    return terminal ?? { status: "disconnected", message: "최종 결과 없이 연결이 종료되었습니다. 서버 상태를 다시 조회하세요." };
  } catch (error) {
    if (signal?.aborted) throw new DOMException("수집 연결 종료", "AbortError");
    return { status: "disconnected", message: error instanceof Error ? error.message : "수집 연결이 종료되었습니다." };
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
