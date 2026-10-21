"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageSquarePlus, Square } from "lucide-react";
import { FollowUpQuestions } from "./FollowUpQuestions";
import type { Evidence } from "./EvidenceView";
import { AnswerView } from "./AnswerView";
import { readAnswer, readResolution } from "../api/stream";
import { ActivityTimeline, type Activity } from "./ActivityTimeline";
import "./sec-chat.css";

type Company = { cik: string; name: string; ticker: string };
type Prepared = { threadId: string; filing: { accessionNo: string; filingDate: string }; checkedAt: string | null; missingItems: string[] };
type Message = { role: "user" | "assistant"; text: string; program?: string; evidence?: Evidence; followUps?: string[]; activities?: Activity[] };
type Choice = { companies: Company[]; question: string; refresh: boolean };
type Resolution = { followUps?: string[]; program?: string } & ({ action: "reply"; reply: string } | ({ action: "choose"; reply: string } & Choice) | { action: "research"; company: Company | null; question: string; refresh: boolean });
const suggestions = ["애플은 어떻게 돈을 벌어?", "엔비디아의 주요 사업 리스크를 알려줘", "10-K를 볼 때 무엇부터 읽으면 좋을까?"];

async function jsonRequest<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/sec-chat/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "요청에 실패했습니다.");
  return result;
}

export function SecChat() {
  const [company, setCompany] = useState<Company>();
  const [prepared, setPrepared] = useState<Prepared>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [choice, setChoice] = useState<Choice>();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const activityLog = useRef<Activity[]>([]);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, choice]);
  useEffect(() => () => { abort.current?.abort(); }, []);

  function recordActivity(activity: Activity) {
    const previous = activityLog.current;
    activityLog.current = previous.some(item => item.id === activity.id) ? previous.map(item => item.id === activity.id ? activity : item) : [...previous, activity];
    setActivities(activityLog.current);
  }

  async function trackRequest<T>(label: string, request: () => Promise<T>): Promise<T> {
    const activity: Activity = { id: crypto.randomUUID(), label, kind: "request", status: "running" };
    recordActivity(activity);
    try {
      const result = await request(); recordActivity({ ...activity, status: "completed" }); return result;
    } catch (e) {
      recordActivity({ ...activity, status: abort.current?.signal.aborted ? "cancelled" : "failed" }); throw e;
    }
  }

  function append(message: Message) { setMessages(previous => [...previous, message.role === "assistant" ? { ...message, activities: activityLog.current } : message]); }

  async function research(selected: Company | null, text: string, refresh: boolean, signal: AbortSignal) {
    const target = selected ?? company;
    if (!target) throw new Error("분석할 기업을 알려 주세요.");
    let active = prepared;
    if (!active || target.cik !== company?.cik || refresh) {
      setBusy(`${target.name}의 최신 10-K를 확인하고 있어요. 다운로드에는 수 분이 걸릴 수 있어요.`);
      const next = await trackRequest(`${target.name} · 최신 10-K 준비`, () => jsonRequest<Prepared>("prepare", { cik: target.cik, refresh: true }, signal));
      setPrepared(next); setCompany(target);
      if (active) void fetch(`/api/sec-chat/threads/${active.threadId}`, { method: "DELETE" }).catch(() => undefined);
      active = next;
    }
    setBusy(`${target.name}의 원문 근거를 읽고 있어요`);
    const response = await fetch("/api/sec-chat/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: active.threadId, message: text }), signal });
    const { program, followUps, evidence } = await readAnswer(response, recordActivity);
    append({ role: "assistant", text: `${target.name}의 10-K 원문에 근거한 답변: ${text}`, program, followUps, evidence });
  }

  async function send(text: string, selected?: Company) {
    if (!text.trim() || abort.current) return;
    const pending = choice;
    const controller = new AbortController(); abort.current = controller;
    activityLog.current = []; setActivities([]);
    setBusy("메시지를 읽고 있어요"); setError(""); setQuestion(""); setChoice(undefined);
    append({ role: "user", text });
    try {
      if (selected && pending) {
        await research(selected, pending.question, pending.refresh, controller.signal);
      } else {
        const result = await trackRequest("대화 요청", async () => {
          const response = await fetch("/api/sec-chat/resolve", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ message: text, threadId: prepared?.threadId, history: messages.slice(-12).map(({ role, text }) => ({ role, text: text.slice(0, 4000) })) }), signal: controller.signal });
          return readResolution<Resolution>(response, recordActivity);
        });
        if (result.action === "reply") append({ role: "assistant", text: result.reply, program: result.program, followUps: result.followUps });
        else if (result.action === "choose") {
          append({ role: "assistant", text: result.reply, program: result.program, followUps: result.followUps }); setChoice(result);
        } else await research(result.company, result.question, result.refresh, controller.signal);
      }
    } catch (e) {
      const message = controller.signal.aborted ? "답변 생성을 중단했어요. 메시지를 다시 보내 이어갈 수 있어요." : (e as Error).message;
      for (const activity of activityLog.current.filter(item => item.status === "running")) recordActivity({ ...activity, status: controller.signal.aborted ? "cancelled" : "failed" });
      append({ role: "assistant", text: "" });
      setError(message); setQuestion(current => current || text);
      if (pending) setChoice(pending);
    } finally {
      abort.current = null; setBusy(""); input.current?.focus();
    }
  }

  async function reset() {
    if (abort.current) return;
    if (prepared) {
      try {
        const response = await fetch(`/api/sec-chat/threads/${prepared.threadId}`, { method: "DELETE" });
        if (!response.ok) throw new Error("대화를 닫지 못했어요. 잠시 후 다시 시도해 주세요.");
      } catch (e) { setError((e as Error).message); return; }
    }
    activityLog.current = []; setActivities([]);
    setMessages([]); setPrepared(undefined); setCompany(undefined); setChoice(undefined); setQuestion(""); setError(""); input.current?.focus();
  }

  return <main className="sec-chat">
    <header className="sec-chat-header"><h1>리서치 채팅</h1><button type="button" onClick={() => void reset()} disabled={!!busy}><MessageSquarePlus size={16} />새 대화</button></header>
    <div className="sec-chat-body">
      {messages.length === 0 && <section className="sec-welcome"><span className="sec-welcome-mark" aria-hidden="true">✳</span><h2>무엇이 궁금하세요?</h2><p>기업 이야기부터 재무 분석까지, 편하게 물어보세요.</p><div className="sec-suggestions">{suggestions.map(text => <button key={text} onClick={() => void send(text)}>{text}<ArrowUp size={15} aria-hidden="true" /></button>)}</div></section>}
      <section className="sec-messages" aria-label="사업보고서 대화" aria-live="polite" aria-relevant="additions">
        {messages.map((message, index) => <article className={`sec-message sec-message-${message.role}`} key={index} aria-label={message.role === "user" ? "내 메시지" : "답변"}>
          {message.role === "assistant" && <span className="sec-message-author">리서치 어시스턴트</span>}
          {message.role === "assistant" && <ActivityTimeline activities={message.activities ?? []} />}
          {message.program ? <AnswerView program={message.program} evidence={message.evidence} onMessage={text => { if (index === messages.length - 1) void send(text); }} onError={() => setError("Intelligent UI 렌더링 오류가 발생했습니다.")} /> : message.role === "assistant" ? <AnswerView program={`root = Col([Markdown(${JSON.stringify(message.text)})])`} /> : <p>{message.text}</p>}
          {message.role === "assistant" && <FollowUpQuestions questions={message.followUps ?? []} disabled={!!busy || index !== messages.length - 1} onSelect={text => void send(text)} />}
        </article>)}
        {choice && <div className="sec-choices" aria-label="기업 확인">{choice.companies.map(item => <button key={item.cik} disabled={!!busy} onClick={() => void send(`${item.name} (${item.ticker})`, item)}><strong>{item.ticker}</strong> {item.name}</button>)}</div>}
      </section>
      {busy && <ActivityTimeline activities={activities} working />}
      <div role="status" className="sec-status">{busy && <><span className="sec-status-dot" />{busy}</>}</div>
      {error && <p role="alert" className="sec-error">{error}</p>}
      <div ref={end} />
    </div>
    <div className="sec-compose-dock">
      {prepared && <details className="sec-selected"><summary>{company?.name} · 10-K · {prepared.filing.filingDate}</summary><p>{prepared.filing.accessionNo}</p><p>{prepared.checkedAt ? `SEC 동기화 확인: ${prepared.checkedAt}` : "저장 문서 기준 — SEC 최신성 미확인"}</p>{prepared.missingItems.length > 0 && <p>추출하지 못한 Item: {prepared.missingItems.join(", ")}</p>}</details>}
      <form className="sec-composer" onSubmit={event => { event.preventDefault(); void send(question); }}>
        <textarea ref={input} aria-label="메시지" value={question} maxLength={4000} onChange={event => setQuestion(event.target.value)} placeholder="무엇이든 물어보세요" rows={2} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) void send(question); } }} />
        {busy ? <button key="stop" type="button" aria-label="답변 중단" onClick={event => { event.preventDefault(); abort.current?.abort(); }}><Square size={17} fill="currentColor" /></button> : <button key="send" type="submit" aria-label="메시지 보내기" disabled={!question.trim()}><ArrowUp size={20} /></button>}
      </form>
      <p className="sec-compose-note">기업 분석은 SEC 10-K 원문을 확인합니다. Enter로 전송 · Shift+Enter로 줄바꿈</p>
    </div>
  </main>;
}
