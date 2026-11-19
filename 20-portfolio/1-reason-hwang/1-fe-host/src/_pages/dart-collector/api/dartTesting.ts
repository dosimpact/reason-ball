import { dartPresets, dartProxyBase, type DartRequest, type DartResult } from "../model/dartTesting";
const maxText = 1024 * 1024;
const maxZip = 64 * 1024 * 1024;

/** Only the five local proxy resources are callable; credentials are server-owned. */
export async function executeDartRequest(request: DartRequest, signal?: AbortSignal): Promise<DartResult> {
  const url = new URL(request.url, "http://dart-testing.invalid");
  const preset = dartPresets.find(item => url.pathname === `${dartProxyBase}${item.path}`);
  if (url.origin !== "http://dart-testing.invalid" || !request.url.startsWith("/") || !preset || request.method !== "GET" || [...url.searchParams.keys()].some(key => !preset.fields.some(field => field.key === key))) throw new Error("고정된 DART 프록시 API만 요청할 수 있습니다.");
  const result: DartResult = { request, status: null, statusText: "", durationMs: 0, headers: {}, outcome: "network-error", bodyText: "" };
  const started = performance.now();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = () => { void reader?.cancel().catch(() => undefined); };
  try {
    const response = await fetch(request.url, { method: "GET", headers: request.headers, cache: "no-store", signal });
    result.status = response.status; result.statusText = response.statusText; result.headers = Object.fromEntries(response.headers.entries());
    result.outcome = response.ok ? "success" : "http-error";
    const zip = response.ok && response.headers.get("content-type")?.toLowerCase().includes("application/zip");
    if (!response.body) return result;
    reader = response.body.getReader(); signal?.addEventListener("abort", cancel, { once: true });
    const chunks: ArrayBuffer[] = []; let total = 0;
    const limit = zip ? maxZip : maxText;
    for (;;) {
      if (signal?.aborted) throw new DOMException("요청 연결을 중단했습니다.", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      const available = Math.max(0, limit - total);
      if (value.byteLength) { const part = value.slice(0, available); chunks.push(part.buffer as ArrayBuffer); total += part.byteLength; }
      if (value.byteLength > available) {
        await reader.cancel();
        if (zip) throw new Error("ZIP 파일이 64 MiB 표시 제한을 초과했습니다.");
        result.truncated = true; break;
      }
    }
    if (signal?.aborted) throw new DOMException("요청 연결을 중단했습니다.", "AbortError");
    const blob = new Blob(chunks, { type: response.headers.get("content-type") ?? "application/octet-stream" });
    if (zip) {
      const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      if (!(signature[0] === 0x50 && signature[1] === 0x4b && ((signature[2] === 3 && signature[3] === 4) || (signature[2] === 5 && signature[3] === 6) || (signature[2] === 7 && signature[3] === 8)))) { result.outcome = "format-error"; result.error = "ZIP 응답 형식이 올바르지 않습니다."; }
      else { const supplied = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1]; result.file = { blob, size: blob.size, filename: (supplied ?? (preset.id === "corporations" ? "dart-corp-codes.zip" : "dart-document.zip")).replace(/[^A-Za-z0-9._-]/g, "_") }; }
    } else {
      result.bodyText = await blob.text();
      if (preset.zip && response.ok) { result.outcome = "format-error"; result.error = "ZIP API에서 ZIP이 아닌 응답을 받았습니다."; }
      if (!result.truncated) { try { result.json = JSON.parse(result.bodyText); } catch { /* Preserve XML/plain text without rendering it. */ } }
    }
  } catch (error) {
    result.outcome = signal?.aborted || (error instanceof Error && error.name === "AbortError") ? "aborted" : result.status === null ? "network-error" : "format-error";
    result.error = error instanceof Error ? error.message : "DART API 요청에 실패했습니다.";
  } finally {
    signal?.removeEventListener("abort", cancel); await reader?.cancel().catch(() => undefined); reader?.releaseLock();
    result.durationMs = Math.round(performance.now() - started);
  }
  return result;
}
