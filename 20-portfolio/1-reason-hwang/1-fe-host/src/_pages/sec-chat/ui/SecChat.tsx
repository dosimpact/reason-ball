"use client";

import { AgentConversation, ChatNotice, ConversationText } from "@/shared/ui/agent-conversation";
import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { HISTORY_KEY, parseHistory, saveHistory, type Company, type Prepared, type Message, type Choice, type Conversation } from "../model/history";
import { FollowUpQuestions } from "./FollowUpQuestions";
import { AnswerView } from "./AnswerView";
import { readAnswer, readPreparation, readResolution } from "../api/stream";
import { ActivityTimeline, type Activity } from "./ActivityTimeline";
import { failureReason, requestFailureReply, type FailureContext } from "../api/failure-reply";
import { secChatStarterGroups } from "../model/starters";
import "./sec-chat.css";

type Resolution = { followUps?: string[]; program?: string } & ({ action: "reply"; reply: string } | ({ action: "choose"; reply: string } & Choice) | { action: "research"; company: Company | null; question: string; refresh: boolean } | { action: "collect"; company: Company | null; years: number; since?: string });


export function SecChat() {
  const [history, setHistory] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [company, setCompany] = useState<Company>();
  const [prepared, setPrepared] = useState<Prepared>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [choice, setChoice] = useState<Choice>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const activityLog = useRef<Activity[]>([]);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    try { setHistory(parseHistory(localStorage.getItem(HISTORY_KEY))); }
    catch { setHistoryError("대화 기록을 불러올 수 없습니다."); }
    setConversationId(crypto.randomUUID()); setHistoryReady(true);
  }, []);
  useEffect(() => {
    if (!historyReady || !conversationId || busy || !messages.length) return;
    setHistory(previous => {
      const title = messages.find(message => message.role === "user")?.text.trim().slice(0, 80) || "SEC 대화";
      const record: Conversation = { id: conversationId, title, updatedAt: new Date().toISOString(), messages, company, prepared, choice };
      const next = [record, ...previous.filter(item => item.id !== conversationId)].slice(0, 50);
      return next;
    });
  }, [historyReady, conversationId, busy, messages, company, prepared, choice]);
  useEffect(() => {
    if (!historyReady) return;
    try { saveHistory(localStorage, history); } catch { setHistoryError("대화 기록을 저장할 수 없습니다. 브라우저 저장 공간을 확인하세요."); }
  }, [history, historyReady]);
  function openConversation(record: Conversation) {
    if (busy) return;
    activityLog.current = []; setActivities([]); setError("");
    setConversationId(record.id); setMessages(record.messages); setCompany(record.company); setPrepared(record.prepared); setChoice(record.choice);
  }


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

  async function research(selected: Company | null, text: string, refresh: boolean, signal: AbortSignal, context: FailureContext) {
    const target = selected ?? company;
    context.stage = "prepare"; context.company = target;
    if (!target) throw new Error("분석할 기업을 알려 주세요.");
    let active = prepared;
    if (!active || target.cik !== company?.cik || refresh) {
      setBusy(refresh ? `${target.name}의 최신 10-K를 확인하고 있어요. 다운로드에는 수 분이 걸릴 수 있어요.` : `${target.name}의 저장된 10-K를 확인하고 있어요.`);
      const next = await trackRequest(`${target.name} · ${refresh ? "최신 10-K 준비" : "저장된 10-K 준비"}`, async () => {
        const response = await fetch("/api/sec-chat/prepare", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ cik: target.cik, refresh: refresh === true }), signal });
        return readPreparation<Prepared>(response, recordActivity);
      });
      setPrepared(next); setCompany(target);
      if (active) void fetch(`/api/sec-chat/threads/${active.threadId}`, { method: "DELETE" }).catch(() => undefined);
      active = next;
    }
    context.stage = "chat";
    setBusy(`${target.name}의 원문 근거를 읽고 있어요`);
    const response = await fetch("/api/sec-chat/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: active.threadId, message: text }), signal });
    const { program, followUps, evidence } = await readAnswer(response, recordActivity);
    append({ role: "assistant", text: `${target.name}의 10-K 원문에 근거한 답변: ${text}`, program, followUps, evidence });
  }

  async function collect(selected: Company | null, years: number, since: string | undefined, signal: AbortSignal, context: FailureContext) {
    const target = selected ?? company;
    context.stage = "collect"; context.company = target;
    if (!target) throw new Error("수집할 기업을 알려 주세요.");
    setBusy(`${target.name}의 10-K·10-Q·8-K 공시를 수집하고 있어요. 수 분이 걸릴 수 있습니다.`);
    const result = await trackRequest(`${target.name} · 공시 수집`, async () => {
      const response = await fetch("/api/sec-chat/collect", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ cik: target.cik, years, ...(since ? { since } : {}) }), signal,
      });
      return readResolution<{ reply: string }>(response, recordActivity);
    });
    append({ role: "assistant", text: result.reply });
  }

  async function send(text: string, selected?: Company) {
    if (!text.trim() || abort.current) return;
    const pending = choice;
    const context: FailureContext = { stage: "resolve" };
    const controller = new AbortController(); abort.current = controller;
    activityLog.current = []; setActivities([]);
    setBusy("메시지를 읽고 있어요"); setError(""); setChoice(undefined);
    append({ role: "user", text });
    try {
      if (selected && pending) {
        if (pending.pendingAction === "collect") await collect(selected, pending.years ?? 2, pending.since, controller.signal, context);
        else await research(selected, pending.question, pending.refresh, controller.signal, context);
      } else {
        const result = await trackRequest("대화 요청", async () => {
          const response = await fetch("/api/sec-chat/resolve", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ message: text, threadId: prepared?.threadId, history: messages.slice(-12).map(({ role, text }) => ({ role, text: text.slice(0, 4000) })) }), signal: controller.signal });
          return readResolution<Resolution>(response, recordActivity);
        });
        if (result.action === "reply") append({ role: "assistant", text: result.reply, program: result.program, followUps: result.followUps });
        else if (result.action === "choose") {
          append({ role: "assistant", text: result.reply, program: result.program, followUps: result.followUps }); setChoice(result);
        } else if (result.action === "collect") await collect(result.company, result.years, result.since, controller.signal, context);
        else await research(result.company, result.question, result.refresh, controller.signal, context);
      }
    } catch (e) {
      context.reason = failureReason(e);
      const message = controller.signal.aborted ? "답변 생성을 중단했어요. 메시지를 다시 보내 이어갈 수 있어요." : (e as Error).message;
      for (const activity of activityLog.current.filter(item => item.status === "running")) recordActivity({ ...activity, status: controller.signal.aborted ? "cancelled" : "failed" });
      if (/세션이 만료/.test(message)) { setPrepared(undefined); setError("분석 세션이 만료되었습니다. 같은 질문을 다시 보내 공시를 다시 준비해 주세요."); }
      else setError(message);
      if (pending) setChoice(pending);
      const cancellation = "답변 생성을 중단했어요. 메시지를 다시 보내 이어갈 수 있어요.";
      if (controller.signal.aborted) append({ role: "assistant", text: cancellation });
      else {
        const recovery: Activity = { id: crypto.randomUUID(), label: "실패 상황 답변 생성", kind: "request", status: "running" };
        recordActivity(recovery); setBusy("실패 상황에 대한 답변을 준비하고 있어요");
        try {
          const result = await requestFailureReply(selected && pending ? pending.question : text, context, controller.signal);
          controller.signal.throwIfAborted();
          recordActivity({ ...recovery, status: result.source === "model" ? "completed" : "unavailable" });
          append({ role: "assistant", text: result.reply });
        } catch {
          recordActivity({ ...recovery, status: "cancelled" });
          setError(cancellation); append({ role: "assistant", text: cancellation });
        }
      }
    } finally {
      abort.current = null; setBusy("");
    }
  }

  async function reset() {
    if (abort.current) return;
    activityLog.current = []; setActivities([]);
    setConversationId(crypto.randomUUID()); setMessages([]); setPrepared(undefined); setCompany(undefined); setChoice(undefined); setError("");
  }

  return <AgentConversation
    title="SEC Intelligent Research Chat"
    description="기업 이야기부터 재무 분석까지, SEC 10-K 원문을 근거로 답변합니다."
    welcomeTitle="무엇이 궁금하세요?"
    starterGroups={secChatStarterGroups}
    busy={!!busy}
    onSend={text => send(text)}
    onCancel={() => abort.current?.abort()}
    onReset={() => void reset()}
    headerControls={<details className="agent-conversation__graph-history"><summary className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"><History size={15} aria-hidden="true" />대화 기록</summary><div className="agent-conversation__graph-history-panel"><p className="mb-2 text-xs text-muted-foreground">이 브라우저에 최근 50개 대화를 저장합니다. 서버 분석 세션은 만료될 수 있습니다.</p>{historyError && <p role="alert">{historyError}</p>}{!history.length && <p className="text-sm">저장된 대화가 없습니다.</p>}<ul aria-label="저장된 SEC 대화">{history.map(record => <li key={record.id}><button type="button" disabled={!!busy} aria-current={record.id === conversationId ? "true" : undefined} className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50" onClick={event => { openConversation(record); const details = event.currentTarget.closest("details"); if (details) details.open = false; }}><span className="block truncate">{record.title}</span><time className="text-xs text-muted-foreground" dateTime={record.updatedAt}>{new Date(record.updatedAt).toLocaleString("ko-KR")}</time></button></li>)}</ul></div></details>}
    toolbar={choice && <div className="sec-choices" aria-label="기업 확인">
      {choice.companies.map(item => <button key={item.cik} disabled={!!busy} onClick={() => void send(`${item.name} (${item.ticker})`, item)}>{item.ticker} {item.name}</button>)}
    </div>}
    status={<>
      {error && <ChatNotice tone="error">{error}</ChatNotice>}
    </>}
    footer={<>
      {prepared && <details className="sec-selected">
        <summary>{company?.name} · 10-K · {prepared.filing.filingDate}</summary>
        <p>{prepared.filing.accessionNo}</p>
        <p>{prepared.checkedAt ? `SEC 동기화 확인: ${prepared.checkedAt}` : "저장 문서 기준 — SEC 최신성 미확인"}</p>
        {prepared.missingItems.length > 0 && <p>추출하지 못한 Item: {prepared.missingItems.join(", ")}</p>}
      </details>}
      <span>기업 분석은 SEC 10-K 원문을 확인합니다. Enter로 전송 · Shift+Enter로 줄바꿈</span>
    </>}
    messages={[...messages.map((message, index) => ({
      id: String(index),
      role: message.role,
      content: message.text,
      view: <>
        <ActivityTimeline activities={message.activities ?? []} />
        {message.program
          ? <AnswerView program={message.program} evidence={message.evidence} onMessage={text => { if (index === messages.length - 1) void send(text); }} onError={() => setError("Intelligent UI 렌더링 오류가 발생했습니다.")} />
          : <div data-testid="intelligent-ui-answer"><ConversationText text={message.text} /></div>}
        <FollowUpQuestions questions={message.followUps ?? []} disabled={!!busy || index !== messages.length - 1} onSelect={text => void send(text)} />
      </>,
    })), ...(busy ? [{
      // The SDK renders a live custom assistant view only after OpenUI syntax is present.
      id: "sec-current-activity", role: "assistant" as const, content: `root = Col([Markdown(${JSON.stringify(busy)})])`,
      view: <><ActivityTimeline activities={activities} working /><ChatNotice tone="status">{busy}</ChatNotice></>,
    }] : [])]}
  />;
}
