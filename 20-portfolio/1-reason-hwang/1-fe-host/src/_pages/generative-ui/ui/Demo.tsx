"use client";
import { AgentConversation, ChatNotice } from "@/shared/ui/agent-conversation";
import { useEffect, useRef, useState } from "react";
import { OutputView, type BusinessRequest } from "@/shared/ui/intelligent-ui";
import { readOutput, type Activity, type UIOutput } from "../api/stream";

type Mode = "dynamic" | "fixed";
const titles = { dynamic: "매출 분석 · Dynamic", fixed: "항공편 선택 · Fixed" };
const examples = { dynamic: "전체 매출 현황을 보여줘 · 담당자별 실적을 비교해줘 · 지역별 매출 비중을 보여줘", fixed: "인천에서 도쿄 가는 항공편 · 기내식만 선택할래 · 좌석과 기내식을 선택할래" };

export function GenerativeDemo({ mode }: { mode: Mode }) {
  const [session, setSession] = useState(0);
  return <Session key={`${mode}-${session}`} mode={mode} onReset={() => setSession(value => value + 1)} />;
}

function Session({ mode, onReset }: { mode: Mode; onReset: () => void }) {
  const thread = useRef("");
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<Activity | null>(null);
  const [turns, setTurns] = useState<Array<{ question: string; output: UIOutput }>>([]);
  const current = turns.at(-1)?.output;
  useEffect(() => () => controller.current?.abort(), []);

  async function run(question: string, action?: BusinessRequest) {
    if (controller.current) return;
    thread.current ||= crypto.randomUUID();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(""); setActivity(null);
    try {
      const response = await fetch(`/api/generative-ui/${mode}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, signal: request.signal,
        body: JSON.stringify({ thread_id: thread.current, message: question, ...(action && current ? { action: { ...action, revision: current.revision } } : {}) }),
      });
      const output = await readOutput(response, setActivity);
      if (!request.signal.aborted) {
        setTurns(previous => [...previous, { question: question || "선택 내용 반영", output }]);
      }
    } catch (failure) {
      if (!request.signal.aborted) { setError(failure instanceof Error ? failure.message : "화면 생성에 실패했습니다."); setActivity(previous => previous ? { ...previous, status: "failed" } : null); }
    } finally {
      if (controller.current === request) { controller.current = null; setBusy(false); }
    }
  }
  function cancel() { controller.current?.abort(); setActivity(null); }
  return <AgentConversation busy={busy} title={titles[mode]} welcomeTitle="어떤 화면을 만들어 볼까요?"
      description={examples[mode]} onReset={onReset}
      footer={<ChatNotice>가상 데이터 데모이며 실제 매출·운항·예약 정보가 아닙니다. 대화는 서버 재시작 또는 만료 후 유지되지 않습니다.</ChatNotice>}
      status={<>{activity && <ChatNotice tone="status">{activity.label} · {activity.status === "completed" ? "완료" : activity.status === "failed" ? "실패" : "진행 중"}</ChatNotice>}{error && <ChatNotice tone="error">{error}</ChatNotice>}</>} onSend={question => run(question)} onCancel={cancel} messages={turns.flatMap((turn, index) => [
      { id: `user-${turn.output.revision}`, role: "user" as const, content: turn.question },
      { id: `assistant-${turn.output.revision}`, role: "assistant" as const, content: "", view: <article><fieldset disabled={busy || index !== turns.length - 1} className="min-w-0 space-y-5">
        {turn.output.program && <OutputView program={turn.output.program} busy={busy} onMessage={value => void run(value)} onError={() => setError("분석 화면을 표시하지 못했습니다.")} />}
        {turn.output.controls && <OutputView program={turn.output.controls} busy={busy} onBusinessAction={action => { if (index === turns.length - 1) void run("", action); }} onError={() => setError("선택 화면을 표시하지 못했습니다.")} />}
      </fieldset>
      {index !== turns.length - 1 && <p className="mt-3 text-sm text-muted-foreground">이전 결과입니다. 선택은 최신 화면에서 진행하세요.</p>}
    </article> },
    ])} />;
}
