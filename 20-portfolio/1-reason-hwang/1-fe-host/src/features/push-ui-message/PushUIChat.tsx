"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { applyEvent, finishTurn, Turn } from "./model";
import { readEvents } from "./stream";
import { TurnView } from "./TurnView";

export function PushUIChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || controller.current) return;
    const turn: Turn = { id: crypto.randomUUID(), question, answer: "", steps: [], status: "running" };
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setInput("");
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
      setBusy(false);
    }
  }

  return <section className="mx-auto w-full max-w-3xl space-y-6 py-6">
    <header className="space-y-2">
      <p className="text-sm text-muted-foreground">LangGraph · 독립 학습 예제</p>
      <h1 className="text-2xl font-semibold">Push UI Message Chat</h1>
      <p className="text-sm text-muted-foreground">답변마다 도구 호출과 실행 진행 정보를 누적합니다. 자료 조사와 매출 조회는 로컬 데모 데이터입니다.</p>
      <p className="text-sm">예시: 매출 집계 기준을 조사하고 서울 매출을 조회해줘</p>
    </header>
    <div className="space-y-5">{turns.map((turn) => <TurnView key={turn.id} turn={turn} />)}</div>
    <form onSubmit={submit} className="space-y-3 rounded-xl border p-4">
      <label htmlFor="push-ui-input" className="text-sm font-medium">메시지</label>
      <textarea id="push-ui-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000} rows={3}
        className="w-full rounded-md border bg-background p-3" placeholder="질문을 입력하세요" disabled={busy} />
      <div className="flex gap-3">
        <button type="submit" disabled={busy || !input.trim()} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">전송</button>
        {busy && <button type="button" onClick={() => controller.current?.abort()} className="rounded-md border px-4 py-2">취소</button>}
        <button type="button" disabled={busy} onClick={() => setTurns([])} className="rounded-md border px-4 py-2 disabled:opacity-50">새 대화</button>
      </div>
    </form>
  </section>;
}
