"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OutputView, type BusinessRequest } from "@/shared/ui/intelligent-ui";
import { readOutput, type Activity, type UIOutput } from "../api/stream";

type Mode = "dynamic" | "fixed" | "sec";
const titles = { dynamic: "매출 분석 · Dynamic", fixed: "항공편 선택 · Fixed", sec: "SEC 회사 조회 · 공시 분석" };
const examples = { dynamic: "전체 매출 현황을 보여줘 · 담당자별 실적을 비교해줘 · 지역별 매출 비중을 보여줘", fixed: "인천에서 도쿄 가는 항공편 · 기내식만 선택할래 · 좌석과 기내식을 선택할래", sec: "회사명·티커로 검색하고 공시를 선택하세요. 공시 선택 후 원하는 분석을 요청할 수 있습니다." };

export function GenerativeDemo({ mode }: { mode: Mode }) {
  const [session, setSession] = useState(0);
  return <main className="mx-auto max-w-5xl p-6"><header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><Link href="/a2ui" className="text-sm underline">Generative UI</Link><h1 className="mt-2 text-2xl font-semibold">{titles[mode]}</h1></div><button className="rounded border px-4 py-2" onClick={() => setSession(value => value + 1)}>새 대화</button></header><Session key={`${mode}-${session}`} mode={mode} /></main>;
}

function Session({ mode }: { mode: Mode }) {
  const thread = useRef("");
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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
        setMessage("");
      }
    } catch (failure) {
      if (!request.signal.aborted) { setError(failure instanceof Error ? failure.message : "화면 생성에 실패했습니다."); setActivity(previous => previous ? { ...previous, status: "failed" } : null); }
    } finally {
      if (controller.current === request) { controller.current = null; setBusy(false); }
    }
  }
  function cancel() { controller.current?.abort(); setActivity(null); }
  return <section>
    <p className="mb-4 rounded-lg bg-muted p-4 text-sm">{examples[mode]}</p>
    <p className="mb-4 text-sm text-muted-foreground">{mode === "sec" ? "연결된 서비스에 저장된 공시를 사용합니다." : "가상 데이터 데모이며 실제 매출·운항·예약 정보가 아닙니다."} 대화는 서버 재시작 또는 만료 후 유지되지 않습니다.</p>
    <div className="space-y-6" aria-live="polite">{turns.map((turn, index) => <article key={turn.output.revision} className="rounded-xl border p-5">
      <h2 className="mb-4 font-semibold">{turn.question}</h2>
      <fieldset disabled={busy || index !== turns.length - 1} className="min-w-0 space-y-5">
        {turn.output.program && <OutputView program={turn.output.program} busy={busy} onMessage={value => void run(value)} onError={() => setError("분석 화면을 표시하지 못했습니다.")} />}
        {turn.output.controls && <OutputView program={turn.output.controls} busy={busy} onBusinessAction={action => { if (index === turns.length - 1) void run("", action); }} onError={() => setError("선택 화면을 표시하지 못했습니다.")} />}
      </fieldset>
      {index !== turns.length - 1 && <p className="mt-3 text-sm text-muted-foreground">이전 결과입니다. 선택은 최신 화면에서 진행하세요.</p>}
    </article>)}</div>
    {activity && <p role="status" className="my-4">{activity.label} · {activity.status === "completed" ? "완료" : activity.status === "failed" ? "실패" : "진행 중"}</p>}
    {error && <p role="alert" className="my-4 text-red-700">{error}</p>}
    <form className="mt-6 flex gap-3" onSubmit={event => { event.preventDefault(); if (message.trim()) void run(message.trim()); }}>
      <label className="flex-1"><span className="sr-only">질문</span><textarea aria-label="질문" className="min-h-24 w-full rounded border p-3" maxLength={4000} value={message} onChange={event => setMessage(event.target.value)} placeholder={mode === "sec" ? "회사명·티커 또는 선택 공시 분석 요청" : "질문을 입력하세요"} /></label>
      {busy ? <button type="button" onClick={cancel} className="rounded border px-4">중지</button> : <button disabled={!message.trim()} className="rounded border px-4 disabled:opacity-50">보내기</button>}
    </form>
  </section>;
}
