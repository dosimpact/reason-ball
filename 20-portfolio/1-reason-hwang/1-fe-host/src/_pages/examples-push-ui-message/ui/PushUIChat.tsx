"use client";

import { useEffect, useRef, useState } from "react";
import { applyEvent, finishTurn, Turn } from "../model/model";
import { readEvents } from "../api/stream";
import { AgentConversation } from "@/shared/ui/agent-conversation";
import { TurnView } from "./TurnView";

export function PushUIChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function submit(question: string) {
    if (!question || controller.current) return;
    const turn: Turn = { id: crypto.randomUUID(), question, answer: "", steps: [], status: "running" };
    const abort = new AbortController();
    controller.current = abort;
    setTurns((current) => [...current, turn]);
    const update = (transform: (value: Turn) => Turn) => setTurns((current) => current.map((item) => item.id === turn.id ? transform(item) : item));
    try {
      const history = turns.filter((item) => item.status === "completed" && item.answer).flatMap((item) => [
        { role: "user", content: item.question }, { role: "assistant", content: item.answer.slice(0, 4000) },
      ]).slice(-20);
      const response = await fetch("/api/examples/push-ui-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }), signal: abort.signal,
      });
      await readEvents(response, (event) => update((item) => applyEvent(item, event)));
    } catch (error) {
      update((item) => finishTurn(item, abort.signal.aborted ? "cancelled" : "failed",
        abort.signal.aborted ? "요청을 취소했습니다." : error instanceof Error ? error.message : "요청 실패"));
    } finally {
      controller.current = null;
    }
  }

  return <section className="mx-auto w-full max-w-3xl space-y-6 py-6">
    <header className="space-y-2">
      <p className="text-sm text-muted-foreground">LangGraph · 독립 학습 예제</p>
      <h1 className="text-2xl font-semibold">Push UI Message Chat</h1>
      <p className="text-sm text-muted-foreground">답변마다 도구 호출과 실행 진행 정보를 누적합니다. 자료 조사와 매출 조회는 로컬 데모 데이터입니다.</p>
      <p className="text-sm">예시: 매출 집계 기준을 조사하고 서울 매출을 조회해줘</p>
    </header>
    <AgentConversation title="Push UI Message" onSend={submit} onCancel={() => controller.current?.abort()} onReset={() => { if (!controller.current) setTurns([]); }} messages={turns.flatMap(turn => [
      { id: `${turn.id}-user`, role: "user" as const, content: turn.question },
      { id: turn.id, role: "assistant" as const, content: turn.answer, view: <TurnView turn={turn} /> },
    ])} />
  </section>;
}
