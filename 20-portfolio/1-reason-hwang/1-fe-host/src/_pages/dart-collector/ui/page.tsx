"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, Send, Square } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { executeDartRequest } from "../api/dartTesting";
import { buildDartRequest, dartPresets, type DartRequest, type DartResult } from "../model/dartTesting";

const inputClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const labels = { success: "HTTP 완료", "http-error": "HTTP 오류", "network-error": "네트워크 오류", aborted: "요청 연결 중단", "format-error": "응답 형식 오류" };
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function copyableResult(result: DartResult | undefined) {
  if (!result) return undefined;
  const { file, ...metadata } = result;
  return { ...metadata, ...(file ? { file: { filename: file.filename, size: file.size, contentType: file.blob.type } } : {}) };
}

export default function DartCollectorPage() {
  const [presetId, setPresetId] = useState(dartPresets[0].id);
  const preset = dartPresets.find(item => item.id === presetId) ?? dartPresets[0];
  const [values, setValues] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<DartRequest>();
  const [result, setResult] = useState<DartResult>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current?.abort(); pending.current = null; }; }, []);
  useEffect(() => {
    setValues(Object.fromEntries(preset.fields.map(field => [field.key, field.value ?? ""])));
    setEnabled(Object.fromEntries(preset.fields.map(field => [field.key, field.enabled ?? false])));
    setError("");
  }, [preset]);
  useEffect(() => {
    if (!result?.file) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(result.file.blob); setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  let preview: DartRequest | undefined;
  try { preview = buildDartRequest(presetId, Object.fromEntries(Object.entries(values).filter(([key]) => enabled[key] && preset.fields.some(field => field.key === key)))); }
  catch { /* The fixed preset always supplies an allowed request. */ }
  async function send() {
    if (pending.current || !preview) return;
    const controller = new AbortController(); pending.current = controller;
    const request = preview;
    setSent(request); setResult(undefined); setRunning(true); setError(""); setCopyMessage("");
    try {
      const response = await executeDartRequest(request, controller.signal);
      if (mounted.current && pending.current === controller) setResult(response);
    } catch (failure) {
      if (mounted.current && pending.current === controller) setError(failure instanceof Error ? failure.message : "요청에 실패했습니다.");
    } finally {
      if (pending.current === controller) { pending.current = null; if (mounted.current) setRunning(false); }
    }
  }
  async function copy(kind: "draft" | "request" | "response") {
    try {
      const value = kind === "draft" ? preview : kind === "request" ? sent : copyableResult(result);
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2) ?? "");
      setCopyMessage(kind === "response" ? "응답을 복사했습니다. ZIP은 파일 정보만 포함합니다." : "키가 없는 요청을 복사했습니다.");
    } catch { setCopyMessage("클립보드에 복사할 수 없습니다."); }
  }
  const dartPayload = isRecord(result?.json) ? typeof result.json.status === "string" ? result.json : isRecord(result.json.dart) ? result.json.dart : undefined : undefined;
  const dartStatus = typeof dartPayload?.status === "string" ? dartPayload.status : undefined;
  const businessError = dartStatus !== undefined && dartStatus !== "000";
  return <main className="mx-auto grid max-w-[1200px] gap-5 p-4 pb-20 md:p-6" aria-label="DART API Testing">
    <header><h1 className="text-2xl font-bold">DART API Testing</h1><p className="mt-1 text-sm text-muted-foreground">Open DART 핵심 5개 API를 서버 프록시로 직접 호출하고 요청·응답을 확인합니다.</p></header>
    <section className="min-w-0 rounded-xl border bg-card p-4 shadow-sm" aria-label="DART 요청">
      <h2 className="mb-3 text-lg font-semibold">Request</h2>
      <p className="mb-4 text-xs text-muted-foreground">인증키는 BFF 서버의 API_K_DART 설정을 사용합니다. 이 화면의 요청 URL과 복사 결과에 키를 넣지 않습니다. 데이터 저장·AI 분석은 실행하지 않습니다.</p>
      <fieldset disabled={running} className="grid gap-4">
        <label className="grid gap-1 text-sm font-medium">API 프리셋<select className={inputClass} value={presetId} onChange={event => setPresetId(event.target.value)}>{dartPresets.map(item => <option key={item.id} value={item.id}>GET · {item.label}</option>)}</select></label>
        <div className="flex min-w-0 items-start gap-2 rounded-lg bg-muted p-3"><Badge>GET</Badge><code className="break-all text-sm">/api/dart/{preset.path}</code><Badge variant="secondary">{preset.zip ? "ZIP 다운로드" : "JSON"}</Badge></div>
        {!preset.fields.length ? <p className="text-sm text-muted-foreground">추가 인자 없이 전체 고유번호 ZIP 파일을 요청합니다.</p> : <div><h3 className="mb-2 font-medium">Query Params</h3><div className="grid gap-3">{preset.fields.map(field => <div key={field.key} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[auto_minmax(150px,1fr)_minmax(0,2fr)]"><input className="mt-2" type="checkbox" aria-label={`${field.key} 전송`} checked={!!enabled[field.key]} onChange={event => setEnabled(previous => ({ ...previous, [field.key]: event.target.checked }))} /><label htmlFor={`dart-param-${field.key}`} className="min-w-0 text-sm"><strong>{field.label}</strong>{field.required && <span className="ml-1 text-xs text-muted-foreground">필수</span>}<span className="block break-all font-mono text-xs text-muted-foreground">{field.key} · {field.type}</span></label><input id={`dart-param-${field.key}`} aria-label={field.key} className={`${inputClass} col-start-2 sm:col-start-auto`} value={values[field.key] ?? ""} onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))} /></div>)}</div></div>}
      </fieldset>
      <p className="mt-3 text-xs text-muted-foreground">체크한 인자만 입력값 그대로 전송합니다. 필수값·형식·범위 오류는 서버 응답으로 확인할 수 있습니다. GET 요청이며 자동 실행·재시도하지 않습니다.</p>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><Button disabled={running || !preview} onClick={() => void send()}><Send aria-hidden="true" />Send 요청 보내기</Button>{running && <Button variant="outline" onClick={() => pending.current?.abort()}><Square aria-hidden="true" />요청 연결 중단</Button>}<Button variant="outline" disabled={!preview} onClick={() => void copy("draft")}><Copy aria-hidden="true" />예정 요청 복사</Button></div>
      <details className="mt-4"><summary className="cursor-pointer text-sm">전송 예정 요청</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{JSON.stringify(preview, null, 2)}</pre></details>
    </section>
    {(sent || result || running) && <section className="min-w-0 rounded-xl border bg-card p-4 shadow-sm" aria-label="DART 응답"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Response</h2><div className="flex gap-2"><Button variant="outline" disabled={!sent} onClick={() => void copy("request")}>전송 요청 복사</Button><Button variant="outline" disabled={!result} onClick={() => void copy("response")}>응답 복사</Button></div></div>
      {running && <p role="status" className="mb-3 text-sm">응답 수신 중…</p>}
      {result && <div className="mb-3 flex flex-wrap items-center gap-3 text-sm"><strong>HTTP {result.status ?? "—"} {result.statusText}</strong><span>{result.durationMs} ms</span><Badge variant={result.outcome === "success" && !businessError ? "secondary" : "destructive"}>{businessError ? "DART 업무 오류" : labels[result.outcome]}</Badge><span className="break-all">Content-Type: {result.headers["content-type"] ?? "—"}</span></div>}
      {dartStatus && <p className="mb-3 text-sm">DART status: <strong>{dartStatus}</strong>{typeof dartPayload?.message === "string" ? ` · ${dartPayload.message}` : ""}</p>}
      {result?.error && <p role="alert" className="mb-3 text-sm text-destructive">{result.error}</p>}
      <details className="mb-3"><summary className="cursor-pointer text-sm">실제 전송 요청</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(sent, null, 2)}</pre></details>
      {result && <details className="mb-3"><summary className="cursor-pointer text-sm">Response Headers</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(result.headers, null, 2)}</pre></details>}
      {result?.file ? <div className="rounded-lg border bg-muted/40 p-4"><h3 className="font-semibold">ZIP 파일</h3><p className="my-2 break-all text-sm">{result.file.filename} · {result.file.size.toLocaleString()} bytes</p><p className="mb-3 text-xs text-muted-foreground">바이너리를 텍스트나 XML로 해석하지 않습니다. 파일을 내려받아 별도로 확인하세요.</p>{downloadUrl && <a className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm underline" href={downloadUrl} download={result.file.filename}><Download size={16} aria-hidden="true" />ZIP 다운로드</a>}</div> : result && <div><h3 className="mb-2 font-medium">Response Body</h3>{result.truncated && <p role="status" className="mb-2 text-xs text-muted-foreground">응답이 1 MiB를 초과하여 앞부분만 보관했습니다. 복사에도 보관된 부분만 포함됩니다.</p>}<pre data-testid="dart-response-body" className="max-h-[480px] overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{result.json !== undefined ? JSON.stringify(result.json, null, 2) : result.bodyText}</pre></div>}
    </section>}
    {copyMessage && <p role="status" className="text-sm text-muted-foreground">{copyMessage}</p>}
    <p className="text-xs text-muted-foreground">API 호출 제한과 조회 가능 범위는 DART 정책을 따릅니다. HTTP 200이어도 JSON의 status가 000이 아니면 업무 오류일 수 있습니다. 요청 연결 중단은 서버 처리의 취소를 보장하지 않습니다.</p>
  </main>;
}
