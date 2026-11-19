"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, Send, Square } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { InspectionEvent, InspectionResult } from "@/shared/api";
import type { RequestLock } from "@/shared/lib/hooks";
import { buildModelingTestRequest, modelingPresets } from "../model/apiTesting";
import { executeModelingTest } from "../api/apiTesting";
import type { ModelingFiling, ModelingRun } from "../model/types";

const inputClass = "min-w-0 rounded-md border bg-background px-3 py-2 text-sm";
const outcome = { success: "응답 수신 완료", "http-error": "HTTP 오류", "sse-error": "SSE 오류", partial: "일부 실패", disconnected: "연결 중단", "network-error": "네트워크 오류", aborted: "응답 대기 중단" };
export function ModelingApiTesting({ execution, onMutation, selected, run, execute = executeModelingTest }: { execution: RequestLock<"modeling" | "api-testing">; onMutation: () => void; selected?: ModelingFiling | null; run?: ModelingRun | null; execute?: typeof executeModelingTest }) {
  const [presetId, setPresetId] = useState(modelingPresets[0].id);
  const preset = modelingPresets.find(item => item.id === presetId)!;
  const [query, setQuery] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [params, setParams] = useState<Record<string, string>>({ stage: "1" });
  const [body, setBody] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<InspectionResult>();
  const [sent, setSent] = useState<{ request: ReturnType<typeof buildModelingTestRequest>; label: string; at: string }>();
  const [events, setEvents] = useState<InspectionEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { setQuery(preset.query); setEnabled(Object.fromEntries(Object.entries(preset.query).map(([key, value]) => [key, value !== ""]))); setBody(preset.body ?? ""); setError(""); }, [preset]);
  let preview: ReturnType<typeof buildModelingTestRequest> | undefined;
  let previewError = "";
  try { preview = buildModelingTestRequest({ presetId, query: Object.fromEntries(Object.entries(query).filter(([key]) => enabled[key])), params, body }); }
  catch (failure) { previewError = failure instanceof Error ? failure.message : "요청을 확인하세요."; }
  const signature = JSON.stringify(preview);
  useEffect(() => setConfirmed(false), [signature, presetId]);
  async function send() {
    if (!preview || controller.current || (preset.mutating && !confirmed) || !execution.acquire("api-testing")) return;
    const abort = new AbortController(); controller.current = abort;
    const request = preview; const mutating = preset.mutating;
    setSent({ request, label: preset.label, at: new Date().toISOString() }); setResult(undefined); setEvents([]); setError(""); setRunning(true); setCopied("");
    try {
      const response = await execute(request, event => { if (mounted.current) setEvents(previous => [...previous.slice(-999), event]); }, abort.signal);
      if (mounted.current) setResult(response);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "요청에 실패했습니다."); }
    finally { controller.current = null; execution.release("api-testing"); if (mounted.current) { setRunning(false); if (mutating) onMutation(); } }
  }
  async function copy(value: unknown, label: string) {
    try { await navigator.clipboard.writeText(JSON.stringify(value, null, 2)); setCopied(label); }
    catch { setError("클립보드에 복사할 수 없습니다."); }
  }
  const locked = !!execution.owner;
  const responseText = result ? typeof result.body === "object" && result.body !== null ? JSON.stringify(result.body, null, 2) : result.bodyText : "";
  return <section className="grid min-w-0 gap-5" aria-label="모델링 API Testing">
    <header><h1 className="text-2xl font-semibold">SEC 모델링 API Testing</h1><p className="mt-2 text-sm text-muted-foreground">고정된 공개 모델링 API만 실행합니다. Query 값과 유효한 JSON body는 업무 검증을 위해 변형 없이 전송합니다. 선택만으로 호출하지 않습니다.</p></header>
    <div className="rounded-xl border bg-card p-4">
      <fieldset disabled={locked} className="grid gap-4">
        <label className="grid gap-1 text-sm">API 프리셋<select className={inputClass} value={presetId} onChange={event => setPresetId(event.target.value)}>{modelingPresets.map(item => <option key={item.id} value={item.id}>{item.method} · {item.label}</option>)}</select></label>
        <code className="break-all rounded bg-muted p-3 text-sm">{preset.method} /api/sec/modeling/{preset.path}</code>
        {!!preset.pathParams?.length && <div className="grid gap-3 sm:grid-cols-2">{preset.pathParams.map(key => <label key={key} className="grid gap-1 text-sm">{key}<input className={inputClass} value={params[key] ?? ""} onChange={event => setParams(previous => ({ ...previous, [key]: event.target.value }))} placeholder={key === "cik" ? "0000320193" : key === "accessionNo" ? "0000320193-26-000001" : key === "runId" ? "서버 실행 UUID" : "서버 응답 식별자"} /></label>)}</div>}
        <Button type="button" variant="outline" disabled={!selected && !run} onClick={() => setParams(previous => ({ ...previous, ...(selected ? { cik: selected.cik, accessionNo: selected.accessionNo } : {}), ...(run ? { runId: run.runId ?? run.id } : {}) }))}>운영 화면의 선택 공시·실행 값 가져오기</Button>
        {!!Object.keys(preset.query).length && <div><h2 className="mb-2 font-medium">Query Params</h2><div className="grid gap-2">{Object.keys(preset.query).map(key => <label key={key} className="grid grid-cols-[auto_minmax(6rem,1fr)_minmax(0,2fr)] items-center gap-2 text-sm"><input type="checkbox" aria-label={`${key} 전송`} checked={!!enabled[key]} onChange={event => setEnabled(previous => ({ ...previous, [key]: event.target.checked }))} /><span>{key}</span><input className={inputClass} aria-label={key} value={query[key] ?? ""} onChange={event => setQuery(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}</div></div>}
        {preset.method === "POST" && <label className="grid gap-1 text-sm">JSON Body<textarea rows={9} spellCheck={false} className={`${inputClass} font-mono`} value={body} onChange={event => setBody(event.target.value)} /></label>}
        {preset.mutating && <label className="flex items-start gap-2 rounded-lg border border-amber-500/50 p-3 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />이 요청은 실제 서버 작업을 생성·취소·재시도할 수 있습니다. 대상과 요청 내용을 확인했습니다.</label>}
      </fieldset>
      {(error || previewError) && <p role="alert" className="my-3 text-sm text-destructive">{error || previewError}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><Button disabled={locked || !preview || (preset.mutating && !confirmed)} onClick={() => void send()}><Send aria-hidden="true" />Send 요청 보내기</Button>{running && <Button variant="outline" onClick={() => controller.current?.abort()}><Square aria-hidden="true" />응답 대기 중단</Button>}<Button variant="outline" disabled={!preview} onClick={() => void copy(preview, "예정 요청")}><Copy aria-hidden="true" />전송 예정 요청 복사</Button></div>
      {locked && !running && <p role="status" className="mt-2 text-sm">운영 화면에서 API 요청을 처리 중입니다.</p>}
      <p className="mt-3 text-xs text-muted-foreground">HTTP202는 접수이며 모델링 완료가 아닙니다. 응답 대기 중단은 서버 job을 취소하거나 저장 결과를 되돌리지 않습니다. 실제 취소는 별도 취소 API를 사용합니다. 탭을 바꿔도 요청과 결과를 유지합니다.</p>
      <details className="mt-3"><summary className="cursor-pointer text-sm">전송 예정 요청</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(preview ?? { error: previewError }, null, 2)}</pre></details>
    </div>
    {sent && <section className="min-w-0 rounded-xl border bg-card p-4" aria-label="API 응답">
      <h2 className="font-semibold">마지막 전송: {sent.label}</h2><p className="my-2 break-all text-xs">{sent.request.method} {sent.request.url} · {new Date(sent.at).toLocaleString("ko-KR")}</p>
      <div className="my-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copy(sent, "실제 요청")}>실제 전송 요청 복사</Button><Button variant="outline" disabled={!result} onClick={() => void copy(result, "응답")}>응답 복사</Button>{copied && <span role="status">{copied} 복사됨</span>}</div>
      {running && <p role="status">HTTP 응답 수신 중…</p>}
      {result && <p className="my-3 text-sm"><strong>HTTP {result.status ?? "—"} {result.statusText}</strong> · {result.durationMs}ms · {result.status === 202 && result.outcome === "success" ? "실행 접수됨 · 완료 아님" : outcome[result.outcome]} · Content-Type: {result.headers["content-type"] ?? "—"}</p>}
      {result?.error && <p role="alert" className="text-sm text-destructive">{result.error}</p>}
      {(result?.truncated || responseText.length > 1024 * 1024) && <p role="status">응답 표시 또는 보관 한도를 초과하여 일부만 표시합니다.</p>}
      <details><summary className="cursor-pointer text-sm">실제 전송 요청</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(sent.request, null, 2)}</pre></details>
      {result && <details className="my-3"><summary className="cursor-pointer text-sm">Response Headers</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(result.headers, null, 2)}</pre></details>}
      {events.length > 0 && <section><h3>SSE 이벤트</h3><ol className="max-h-64 overflow-auto text-xs" aria-live="polite">{events.map((event, index) => <li key={index} className="break-all">{event.type} {JSON.stringify(event.data)}</li>)}</ol></section>}
      {result && <><h3 className="mt-3 font-medium">Response Body</h3><pre className="mt-2 max-h-[30rem] overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{responseText.slice(0, 1024 * 1024)}</pre></>}
    </section>}
  </section>;
}
