"use client";
import { useMemo, useState } from "react";
import { Button } from "@/shared/ui/button";
const displayLimit = 100000;
export function GraphTestResult({ result }: { result: unknown }) {
  const text = useMemo(() => JSON.stringify(result, null, 2) ?? "null", [result]);
  const [copyStatus, setCopyStatus] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopyStatus("전체 결과를 복사했습니다."); }
    catch { setCopyStatus("클립보드에 복사할 수 없습니다."); }
  }
  return <section aria-label="그래프 실행 결과"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">실행 결과</h2><Button variant="outline" onClick={() => void copy()}>전체 결과 복사</Button></div>
    {text.length > displayLimit && <p className="mt-2 text-xs text-muted-foreground">전체 {text.length.toLocaleString()}자 중 {displayLimit.toLocaleString()}자만 표시합니다. 복사에는 전체 JSON이 포함됩니다.</p>}
    {copyStatus && <p role="status" className="mt-2 text-xs">{copyStatus}</p>}
    <pre className="agent-conversation__graph-result">{text.slice(0, displayLimit)}</pre>
  </section>;
}
