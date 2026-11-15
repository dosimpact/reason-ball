"use client";
import { useCallback, useState } from "react";
import { Button } from "@/shared/ui/button";
import { OutputView } from "@/shared/ui/intelligent-ui";
import { useChat } from "../model/context/useChat";

export function InlineAnalysis({ program, active }: { program: string; active: boolean }) {
  const { runtime, status, reanalyzeInline } = useChat();
  const [successful, setSuccessful] = useState<Record<string, unknown> | null>(null);
  const onQuerySuccess = useCallback((args: Record<string, unknown>) => setSuccessful(args), []);
  const busy = ["streaming", "creating_thread", "loading_history"].includes(status);
  return <section aria-label="인라인 기술적 분석">
    <p className="my-2 text-xs text-muted-foreground">차트 조회는 모델 없이 실행됩니다. 기존 분석 본문은 최초 스냅샷 기준입니다.</p>
    <Button variant="outline" disabled={busy || !successful} onClick={() => { if (successful) void reanalyzeInline(successful); }}>성공한 조회 조건으로 재분석</Button>
    {successful && <p className="my-2 text-xs">마지막 조회 성공: {String(successful.ticker)} / {String(successful.interval)} / {String(successful.count)}봉</p>}
    <OutputView queryEndpoint={runtime.chartEndpoint} program={program} active={active} onQuerySuccess={onQuerySuccess} />
  </section>;
}
