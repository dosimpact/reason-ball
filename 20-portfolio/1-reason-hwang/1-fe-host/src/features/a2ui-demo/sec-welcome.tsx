"use client";

import { useState, type ReactElement } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { Button } from "@/components/ui/button";

export function SecWelcomeView({ input, busy, onChoose }: { input: ReactElement; busy: boolean; onChoose: (query: string) => void }) {
  return <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:p-8">
    <p className="mb-2 text-sm font-medium text-primary">회사 찾기 → 공시 고르기 → 필요한 내용 분석</p>
    <h2 className="text-2xl font-semibold">어느 회사의 공시를 볼까요?</h2>
    <p className="mb-6 mt-3 text-sm text-muted-foreground">회사명이나 티커를 입력하세요. 분석할 문서는 직접 선택할 수 있습니다.</p>
    <div className="mb-6 flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => onChoose("CPNG 회사를 찾아줘")}>쿠팡 CPNG</Button>
      <Button variant="outline" disabled={busy} onClick={() => onChoose("AAPL 회사를 찾아줘")}>애플 AAPL</Button>
      <Button variant="ghost" disabled={busy} onClick={() => onChoose("뭐가 가능해?")}>무엇을 할 수 있나요?</Button>
    </div>
    {input}
  </div>;
}

export function SecWelcome({ input }: { input: ReactElement }) {
  const { agent, isReady } = useAgent({ agentId: "a2ui-sec" });
  const { copilotkit } = useCopilotKit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = async (query: string) => {
    if (!isReady || busy || agent.isRunning) return;
    setBusy(true);
    setError(null);
    try {
      agent.addMessage({ id: crypto.randomUUID(), role: "user", content: query });
      await copilotkit.runAgent({ agent });
    } catch {
      setError("응답을 받지 못했습니다. 입력창에서 다시 요청해 주세요.");
    } finally { setBusy(false); }
  };
  return <><SecWelcomeView input={input} busy={!isReady || busy || agent.isRunning} onChoose={choose} />{error && <p role="alert">{error}</p>}</>;
}
