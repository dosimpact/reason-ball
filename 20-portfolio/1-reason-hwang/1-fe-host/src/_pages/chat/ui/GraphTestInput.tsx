"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
export function GraphTestInput({ schema, example, description, busy, onRun, onCancel }: { description?: string; schema?: Record<string, unknown>; example?: Record<string, unknown>; busy: boolean; onRun: (input: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(JSON.stringify(example ?? {}, null, 2));
  const [error, setError] = useState("");
  function submit() {
    try {
      const input: unknown = JSON.parse(text);
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("JSON 객체를 입력하세요.");
      setError(""); void onRun(input as Record<string, unknown>);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "JSON 입력을 확인하세요."); }
  }
  return <form className="agent-conversation__graph-composer" onSubmit={event => { event.preventDefault(); submit(); }}>
    {description && <p className="mb-2 text-xs text-muted-foreground">{description}</p>}
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="graph-test-input" className="text-sm font-medium">그래프 입력 JSON</label><div className="flex gap-2"><details className="relative text-xs"><summary className="cursor-pointer">입력 스키마</summary><pre className="absolute bottom-full right-0 z-20 mb-2 max-h-64 w-80 max-w-[85vw] overflow-auto rounded-lg border bg-background p-3">{JSON.stringify(schema ?? {}, null, 2)}</pre></details><button type="button" className="text-xs underline" disabled={busy} onClick={() => { setText(JSON.stringify(example ?? {}, null, 2)); setError(""); }}>예시 입력</button></div></div>
    <textarea id="graph-test-input" aria-label="그래프 입력 JSON" spellCheck={false} value={text} disabled={busy} onChange={event => setText(event.target.value)} />
    {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">이 그래프는 대화 대신 자체 입력 스키마로 실행합니다.</span>{busy ? <Button type="button" variant="outline" onClick={onCancel}>실행 중단</Button> : <Button type="submit">그래프 실행</Button>}</div>
  </form>;
}
