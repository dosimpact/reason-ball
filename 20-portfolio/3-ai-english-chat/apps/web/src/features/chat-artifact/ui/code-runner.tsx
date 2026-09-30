"use client";

import { useEffect, useRef, useState } from "react";
import { copyText as writeClipboard } from "@/shared/lib/clipboard";
import { executeCode } from "../api/execute-code";
import type { CodeExecutionResult } from "../model/code-execution";

export function CodeRunner({ source }: { source: string }) {
  const controller = useRef<AbortController | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CodeExecutionResult>();
  const [copyNotice, setCopyNotice] = useState("");
  useEffect(() => () => {
    const active = controller.current;
    controller.current = undefined;
    active?.abort();
  }, []);

  async function run() {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setRunning(true);
    setResult(undefined);
    setCopyNotice("");
    try {
      const next = await executeCode(source, active.signal);
      if (controller.current === active) setResult(next);
    } catch (error) {
      if (controller.current === active) setResult({ output: "", truncated: false, error: error instanceof Error ? error.message : "실행하지 못했어요." });
    } finally {
      if (controller.current === active) { controller.current = undefined; setRunning(false); }
    }
  }
  async function copyText(text: string) {
    try { await writeClipboard(text); setCopyNotice("복사했어요."); }
    catch { setCopyNotice("복사하지 못했어요. 출력 내용을 직접 선택해 주세요."); }
  }
  return <section className="mt-4 rounded-xl border border-black/8 p-3" aria-label="격리 JavaScript 실행">
    <p className="mb-3 text-xs text-neutral-600">JavaScript · 현재 편집 초안 실행 · 최대 2초 / VM 힙 16MB · DOM, 네트워크, 저장소, 외부 모듈 없음</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void run()} disabled={running} className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{running ? "실행 중…" : "안전 실행"}</button>
      <button type="button" onClick={() => void copyText(source)} className="rounded-lg border px-3 py-2 text-xs font-bold">코드 복사</button>
      {running ? <button type="button" onClick={() => controller.current?.abort()} className="rounded-lg border px-3 py-2 text-xs font-bold">실행 중단</button> : null}
      {result?.output ? <button type="button" onClick={() => void copyText(result.output)} className="rounded-lg border px-3 py-2 text-xs font-bold">출력 복사</button> : null}
    </div>
    {result?.output ? <pre tabIndex={0} className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900" data-testid="code-output">{result.output}</pre> : null}
    {result?.truncated ? <p role="status" className="mt-2 text-xs">출력 제한에 도달해 일부 출력만 표시합니다.</p> : null}
    {result?.error ? <p role="alert" className="mt-3 break-words text-xs text-red-700" data-testid="code-error">{result.error}</p> : null}
    {result && !result.error && !result.output ? <p role="status" className="mt-2 text-xs">실행 완료 · 출력 없음</p> : null}
    {copyNotice ? <p role="status" className="mt-2 text-xs">{copyNotice}</p> : null}
  </section>;
}
