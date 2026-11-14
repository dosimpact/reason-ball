"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Send, Square } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { apiTestPresets, buildTestRequest, type TestRequest, type TestResult, type TestStreamEvent } from "../model/apiTesting";
import { executeTestRequest } from "../api/apiTesting";
import type { ExecutionLock } from "./useExecutionLock";
import { controlClass, ErrorNotice, Field, Section } from "./collector-primitives";

export type ApiTestExecutor = typeof executeTestRequest;
const outcomeLabel: Record<string, string> = { success: "완료", "http-error": "HTTP 오류", "sse-error": "SSE 오류", partial: "일부 실패", disconnected: "연결 중단", "network-error": "네트워크 오류", aborted: "요청 연결 중단" };
export function ApiTesting({ execution, execute = executeTestRequest, onComplete }: { execution: ExecutionLock; execute?: ApiTestExecutor; onComplete: () => void }) {
  const [presetId, setPresetId] = useState(apiTestPresets[0].id);
  const preset = apiTestPresets.find(item => item.id === presetId) ?? apiTestPresets[0];
  const [query, setQuery] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [bodyText, setBodyText] = useState("");
  const [cik, setCik] = useState("");
  const [accessionNo, setAccessionNo] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<TestResult>();
  const [sent, setSent] = useState<TestRequest>();
  const [events, setEvents] = useState<TestStreamEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    setQuery(Object.fromEntries(preset.queryFields.map(field => [field.key, field.defaultValue ?? ""])));
    setEnabled(Object.fromEntries(preset.queryFields.map(field => [field.key, field.enabled ?? false])));
    setBodyText(preset.defaultBody ?? ""); setError("");
  }, [preset]);
  useEffect(() => setConfirmed(false), [presetId, bodyText, query, cik, accessionNo]);
  const bulk = preset.path.includes("all-company-filing-sync-jobs");
  let preview: TestRequest | undefined;
  let previewError = "";
  try { preview = buildTestRequest({ presetId, query: Object.fromEntries(Object.entries(query).filter(([key]) => enabled[key])), bodyText, cik, accessionNo }); }
  catch (failure) { previewError = failure instanceof Error ? failure.message : "요청을 확인하세요."; }
  async function send() {
    if (controller.current || !preview || (bulk && !confirmed) || !execution.acquire("api-testing")) return;
    const abort = new AbortController(); controller.current = abort;
    const request = preview;
    setSent(request); setResult(undefined); setEvents([]); setRunning(true); setError(""); setCopied("");
    try {
      const response = await execute(request, event => { if (mounted.current) setEvents(previous => [...previous.slice(-999), event]); }, abort.signal);
      if (mounted.current) setResult(response);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "요청에 실패했습니다."); }
    finally { controller.current = null; execution.release("api-testing"); if (mounted.current) { setRunning(false); if (request.method === "POST") onComplete(); } }
  }
  async function copy(kind: "request" | "response") {
    try { await navigator.clipboard.writeText(JSON.stringify(kind === "request" ? sent ?? preview : result, null, 2)); setCopied(kind); }
    catch { setError("클립보드에 복사할 수 없습니다."); }
  }
  const locked = !!execution.owner;
  return <div className="grid min-w-0 gap-5">
    <Section title="API Testing"><p className="mb-4 text-sm text-muted-foreground">SEC API 6개의 요청을 직접 보내고 응답을 확인합니다. 입력한 쿼리 값과 JSON을 그대로 전송하므로 잘못된 값의 서버 검증도 테스트할 수 있습니다.</p>
      <fieldset disabled={locked} className="grid gap-4">
        <Field label="API 프리셋"><select className={controlClass} value={presetId} onChange={event => setPresetId(event.target.value)}>{apiTestPresets.map(item => <option value={item.id} key={item.id}>{item.method} · {item.label}</option>)}</select></Field>
        <div className="flex min-w-0 items-start gap-2 rounded-lg bg-muted p-3"><Badge>{preset.method}</Badge><code className="break-all text-sm">/api/sec/{preset.path}</code></div>
        {!!preset.pathParams?.length && <div className="grid gap-3 sm:grid-cols-2"><Field label="경로 CIK"><input className={controlClass} value={cik} onChange={event => setCik(event.target.value)} placeholder="0000320193" /></Field><Field label="경로 접수번호"><input className={controlClass} value={accessionNo} onChange={event => setAccessionNo(event.target.value)} placeholder="0000320193-26-000001" /></Field></div>}
        {!!preset.queryFields.length && <div><h3 className="mb-2 font-medium">Query Params</h3><div className="grid gap-2">{preset.queryFields.map(field => <div className="grid grid-cols-[auto_minmax(100px,1fr)_minmax(0,2fr)] items-center gap-2" key={field.key}><input type="checkbox" aria-label={`${field.key} 전송`} checked={!!enabled[field.key]} onChange={event => setEnabled(previous => ({ ...previous, [field.key]: event.target.checked }))} /><label htmlFor={`api-param-${field.key}`} className="break-all text-sm">{field.key}<span className="ml-1 text-xs text-muted-foreground">{field.type}</span></label><input id={`api-param-${field.key}`} aria-label={field.key} className={controlClass} value={query[field.key] ?? ""} onChange={event => setQuery(previous => ({ ...previous, [field.key]: event.target.value }))} /></div>)}</div></div>}
        {preset.method === "POST" && <Field label="JSON Body"><textarea rows={10} spellCheck={false} className="w-full rounded-md border bg-background p-3 font-mono text-sm" value={bodyText} onChange={event => setBodyText(event.target.value)} /></Field>}
        {bulk && <div className="rounded-lg border border-destructive/50 p-3"><p className="mb-2 text-sm">현재 DB의 모든 티커 기업을 수집하는 API입니다. 서버의 실제 수집 작업을 시작합니다.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />전체 기업 수집 요청임을 확인했습니다.</label></div>}
      </fieldset>
      <ErrorNotice text={error || (previewError && !running ? previewError : "")} />
      <div className="mt-4 flex flex-wrap items-center gap-2"><Button disabled={locked || !preview || (bulk && !confirmed)} onClick={() => void send()}><Send aria-hidden="true" />Send 요청 보내기</Button>{running && <Button variant="outline" onClick={() => controller.current?.abort()}><Square aria-hidden="true" />요청 연결 중단</Button>}<Button variant="outline" disabled={!sent && !preview} onClick={() => void copy("request")}><Copy aria-hidden="true" />{copied === "request" ? "요청 복사됨" : "요청 복사"}</Button>{locked && !running && <span role="status" className="text-sm">수집 관리 탭의 요청이 실행 중입니다.</span>}</div>
      <p className="mt-3 text-xs text-muted-foreground">요청 연결 중단은 서버 작업의 취소나 롤백을 보장하지 않습니다. 탭을 바꿔도 연결과 결과는 유지됩니다.</p>
      <details className="mt-3"><summary className="cursor-pointer text-sm">전송 예정 요청</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{JSON.stringify(preview ?? { error: previewError }, null, 2)}</pre></details>
    </Section>
    {(sent || result || running) && <Section title="Response" action={<Button variant="outline" disabled={!result} onClick={() => void copy("response")}><Copy aria-hidden="true" />{copied === "response" ? "응답 복사됨" : "응답 복사"}</Button>}>
      {running && <p role="status" className="mb-3 text-sm">응답 수신 중…</p>}
      {result && <div className="mb-3 flex flex-wrap gap-3 text-sm"><strong>HTTP {result.status ?? "—"} {result.statusText}</strong><span>{Math.round(result.durationMs)} ms</span><Badge variant={result.outcome === "success" ? "secondary" : "destructive"}>{outcomeLabel[result.outcome] ?? result.outcome}</Badge><span className="break-all">Content-Type: {result.headers["content-type"] ?? "—"}</span></div>}
      <ErrorNotice text={result?.error} />
      {result?.truncated && <p role="status" className="mb-3 text-sm text-amber-600">응답 또는 이벤트가 표시 제한을 초과하여 일부만 보관했습니다.</p>}
      <details className="mb-3"><summary className="cursor-pointer text-sm">실제 전송 요청</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(sent, null, 2)}</pre></details>
      {result && <details className="mb-3"><summary className="cursor-pointer text-sm">Response Headers</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(result.headers, null, 2)}</pre></details>}
      {(events.length > 0 || result?.events.length) ? <div><h3 className="mb-2 font-medium">SSE Events</h3><ol className="max-h-72 overflow-auto rounded bg-muted p-3 font-mono text-xs" aria-live="polite">{(events.length ? events : result?.events ?? []).map((event, index) => <li key={index} className="mb-2 break-all"><strong>{event.type}</strong> {JSON.stringify(event.data)}</li>)}</ol></div> : null}
      {result && <div className="mt-3"><h3 className="mb-2 font-medium">Response Body</h3><pre data-testid="api-response-body" className="max-h-[480px] overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{typeof result.body === "object" && result.body !== null ? JSON.stringify(result.body, null, 2) : result.bodyText}</pre></div>}
    </Section>}
  </div>;
}
