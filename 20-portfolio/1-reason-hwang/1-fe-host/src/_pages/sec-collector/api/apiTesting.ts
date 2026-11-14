import { assertAllowedTestRequest, type TestRequest, type TestResult, type TestStreamEvent } from "../model/apiTesting";
const MAX_TEXT = 1024 * 1024;
const MAX_EVENTS = 1000;

export async function executeTestRequest(request: TestRequest, onEvent?: (event: TestStreamEvent) => void, signal?: AbortSignal): Promise<TestResult> {
  assertAllowedTestRequest(request);
  const started = performance.now();
  const result: TestResult = { request, status: null, statusText: "", durationMs: 0, headers: {}, bodyText: "", events: [], outcome: "network-error" };
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const abort = () => { void reader?.cancel().catch(() => undefined); };
  try {
    const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body, signal, cache: "no-store" });
    result.status = response.status; result.statusText = response.statusText;
    result.headers = Object.fromEntries(response.headers.entries());
    result.outcome = response.ok ? "success" : "http-error";
    const expectedStream = Object.entries(request.headers).some(([key, value]) => key.toLowerCase() === "accept" && value.includes("text/event-stream"));
    if (!response.body) { if (expectedStream && response.ok) { result.outcome = "disconnected"; result.error = "SSE 응답 본문이 없습니다."; } return result; }
    const streaming = response.headers.get("content-type")?.includes("text/event-stream");
    reader = response.body.getReader();
    signal?.addEventListener("abort", abort, { once: true });
    const decoder = new TextDecoder();
    let buffer = "";
    let terminal = false;
    if (streaming && response.ok) result.outcome = "disconnected";
    while (!terminal) {
      if (signal?.aborted) throw new DOMException("요청 중단", "AbortError");
      const { value, done } = await reader.read();
      const text = decoder.decode(value, { stream: !done });
      const remaining = Math.max(0, MAX_TEXT - result.bodyText.length);
      result.bodyText += text.slice(0, remaining);
      if (text.length > remaining) result.truncated = true;
      if (streaming) {
        buffer += text;
        let separator: RegExpExecArray | null;
        while ((separator = /\r?\n\r?\n/.exec(buffer))) {
          const frame = buffer.slice(0, separator.index); buffer = buffer.slice(separator.index + separator[0].length);
          let type = "message";
          const lines: string[] = [];
          for (const line of frame.split(/\r?\n/)) { if (line.startsWith("event:")) type = line.slice(6).trim(); if (line.startsWith("data:")) lines.push(line.slice(5).replace(/^ /, "")); }
          if (!lines.length) continue;
          const raw = lines.join("\n"); let data: unknown;
          try { data = JSON.parse(raw); } catch { data = raw; }
          const event = { type, data };
          if (result.events.length < MAX_EVENTS) result.events.push(event); else result.truncated = true;
          onEvent?.(event);
          if (type === "error") { result.outcome = response.ok ? "sse-error" : "http-error"; result.body = data; terminal = true; }
          if (type === "completed") {
            if (!data || typeof data !== "object" || Array.isArray(data)) { result.outcome = "disconnected"; result.error = "잘못된 최종 SSE 결과입니다."; }
            else result.outcome = !response.ok ? "http-error" : Number((data as Record<string, unknown>).failed ?? 0) > 0 ? "partial" : "success";
            result.body = data; terminal = true;
          }
          if (terminal) break;
        }
        if (buffer.length > MAX_TEXT) throw new Error("SSE 이벤트 크기가 표시 한도를 초과했습니다.");
      } else if (result.truncated) break;
      if (done) break;
    }
    if (signal?.aborted) throw new DOMException("요청 중단", "AbortError");
    if (!streaming && !result.truncated) { try { result.body = JSON.parse(result.bodyText); } catch { result.body = result.bodyText; } }
    if (streaming && !terminal) result.error = "최종 SSE 이벤트 없이 연결이 종료되었습니다.";
    if (expectedStream && response.ok && !streaming) { result.outcome = "disconnected"; result.error = "SSE 대신 다른 형식의 응답을 받았습니다."; }
  } catch (error) {
    result.outcome = signal?.aborted || (error instanceof DOMException && error.name === "AbortError") ? "aborted" : result.status !== null && result.headers["content-type"]?.includes("text/event-stream") ? "disconnected" : "network-error";
    result.error = error instanceof Error ? error.message : "요청에 실패했습니다.";
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
    result.durationMs = Math.round(performance.now() - started);
  }
  return result;
}
