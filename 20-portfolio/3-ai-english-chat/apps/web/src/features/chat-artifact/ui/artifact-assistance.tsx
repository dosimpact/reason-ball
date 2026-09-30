"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createUuid } from "@/shared/lib/uuid";
import { artifactAssistanceResponse, type ArtifactAssistance } from "../model/assistance";
export function ArtifactAssistancePanel({ id, versionId, kind, draft, ready, getSelection, onApply }: {
  id: string; versionId: string; kind: string; draft: string; ready: boolean;
  getSelection: () => { start: number; end: number };
  onApply: (content: string, expectedVersion: string) => Promise<boolean | undefined>;
}) {
  const [result, setResult] = useState<ArtifactAssistance>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const pendingRequest = useRef<{ signature: string; id: string } | undefined>(undefined);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const latest = useRef({ draft, versionId, ready });
  useLayoutEffect(() => { latest.current = { draft, versionId, ready }; }, [draft, versionId, ready]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    async function restore() {
      setPending(true); setError(""); setRestoreFailed(false);
      try {
        const query = new URLSearchParams({ artifactId: id, expectedVersionId: versionId });
        const response = await fetch(`/api/ai/artifact-assistance?${query}`, { cache: "no-store", signal: active.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "저장된 AI 제안을 불러오지 못했어요.");
        const restored = body.item === null ? undefined : artifactAssistanceResponse.parse(body.item);
        if (restored && (restored.artifactId !== id || restored.versionId !== versionId)) throw new Error("제안의 원본 버전을 확인하지 못했어요.");
        if (!active.signal.aborted) setResult(restored);
      } catch (cause) {
        if (!active.signal.aborted) {
          setRestoreFailed(true);
          setError(cause instanceof Error ? cause.message : "저장된 AI 제안을 불러오지 못했어요.");
        }
      } finally { if (!active.signal.aborted) setPending(false); }
    }
    void restore();
    return () => active.abort();
  }, [id, versionId, restoreAttempt]);
  async function ask(mode: "rewrite" | "grammar" | "analysis") {
    controller.current?.abort(); const active = new AbortController(); controller.current = active;
    setPending(true); setError(""); setRestoreFailed(false);
    const input = { artifactId: id, expectedVersionId: versionId, mode, ...(mode === "rewrite" ? { selection: getSelection() } : {}) };
    const signature = JSON.stringify(input);
    if (pendingRequest.current?.signature !== signature) pendingRequest.current = { signature, id: createUuid() };
    try {
      const response = await fetch("/api/ai/artifact-assistance", { method: "POST", headers: { "Content-Type": "application/json" }, signal: active.signal,
        body: JSON.stringify({ ...input, requestId: pendingRequest.current.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "AI 제안을 불러오지 못했어요.");
      const parsed = artifactAssistanceResponse.parse(body);
      if (parsed.artifactId !== id || parsed.versionId !== versionId || parsed.mode !== mode || parsed.sourceContent !== draft) throw new Error("편집 내용이 변경됐어요. 저장 후 다시 요청해 주세요.");
      if (!active.signal.aborted) { setResult(parsed); pendingRequest.current = undefined; }
    } catch (cause) { if (!active.signal.aborted) setError(cause instanceof Error ? cause.message : "AI 제안을 불러오지 못했어요."); }
    finally { if (!active.signal.aborted) setPending(false); }
  }
  const stale = !!result && (result.versionId !== versionId || result.sourceContent !== draft);
  async function apply() {
    if (!result || stale || !ready) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/artifacts/${id}`, { cache: "no-store" });
      const current = await response.json();
      if (!response.ok || current.item?.currentVersionId !== result.versionId || current.item?.status === "archived") throw new Error("다른 창에서 Artifact가 변경됐어요. 최신 버전을 다시 불러와 주세요.");
      if (!latest.current.ready || latest.current.versionId !== result.versionId || latest.current.draft !== result.sourceContent) throw new Error("초안이 변경됐어요. 저장 후 다시 요청해 주세요.");
      const content = result.mode === "rewrite" && result.selection
        ? `${draft.slice(0, result.selection.start)}${result.result.suggestion}${draft.slice(result.selection.end)}` : result.result.suggestion;
      if (await onApply(content, result.versionId)) setResult(undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI 제안을 적용하지 못했어요."); }
    finally { setPending(false); }
  }
  return <section className="mt-4 rounded-xl border border-indigo-200 p-3" aria-label="Artifact AI 도움">
    <p className="text-xs font-bold">AI 제안 · 적용 전까지 원본을 유지합니다.</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={!ready || pending} onClick={() => void ask("rewrite")} className="rounded-lg border px-3 py-2 text-xs">AI 선택 영역 다듬기</button>
      {kind === "text" ? <button type="button" disabled={!ready || pending} onClick={() => void ask("grammar")} className="rounded-lg border px-3 py-2 text-xs">AI 문법 제안</button> : null}
      {kind === "sheet" ? <button type="button" disabled={!ready || pending} onClick={() => void ask("analysis")} className="rounded-lg border px-3 py-2 text-xs">AI Sheet 분석</button> : null}
    </div>
    {pending ? <p role="status">AI 요청을 처리하고 있어요…</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error} 원본과 초안은 유지됩니다.</p> : null}
    {restoreFailed ? <button type="button" disabled={pending} onClick={() => setRestoreAttempt(value => value + 1)} className="mt-2 rounded-lg border px-3 py-2 text-xs">저장된 AI 제안 다시 불러오기</button> : null}
    {result ? <div data-testid="artifact-ai-result" className="mt-3 whitespace-pre-wrap break-words text-sm">
      <p data-testid="artifact-ai-suggestion">{result.result.suggestion}</p><p>{result.result.explanation}</p>
      {stale ? <p role="status">내용이 변경되어 이 제안을 적용할 수 없어요. 다시 요청해 주세요.</p> : null}
      {result.mode !== "analysis" ? <button type="button" disabled={!ready || pending || stale} onClick={() => void apply()} className="mt-2 rounded-lg bg-indigo-700 px-3 py-2 text-white">AI 제안 적용</button> : null}
    </div> : null}
  </section>;
}
