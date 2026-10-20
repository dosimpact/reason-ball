"use client";

import Link from "next/link";
import { buildMessage } from "@openuidev/react-lang";
import { ChatUI } from "./chat-ui";
import { CanvasSplitter } from "./splitter";
import { ThemeToggle } from "./theme";
import { useEffect, useReducer, useRef, useState } from "react";
import { ArrowUp, FileChartColumn, MessageSquareQuote, PanelRightOpen, Plus, X } from "lucide-react";
import { ReportView } from "./report-view";
import { consumeSse } from "./stream";
import { reduceChat, reduceReport, type CanvasEvent, type ChatMessage, type Quote, type Report, type Thread } from "./state";
import "./workspace.css";

const STARTER_GROUPS = [
  { title: "리포트 만들기", description: "Canvas에서 확인하고 PDF로 저장하세요.", open: true, questions: [
    "공급업체1 리포트 생성해줘",
    "공급업체1 PDF 보고서용으로 리포트 만들어줘",
  ] },
  { title: "공급업체에 질문하기", description: "원문을 바탕으로 채팅에서 시각화해 답합니다.", open: true, questions: [
    "공급업체1의 W1/W2 광고 매출을 비교하고 수치 모순도 설명해줘",
    "공급업체1의 재고 위험에서 우선 확인할 상품을 알려줘",
    "어떤 공급업체 자료가 있어?",
  ] },
  { title: "일상 · 여행 · 인터랙티브 UI", description: "일정부터 계산기와 게임까지, 원하는 화면을 만들어 보세요.", open: false, questions: [
    "Plan a relaxed day out in Seoul with three stops",
    "Plan a relaxed afternoon exploring Lisbon, with three stops and a map",
    "Find weekend ideas for a rainy day at home",
    "Plan a vegetarian meal for two with a shopping list",
    "Build a calculator for splitting a restaurant bill with a tip",
    "Play on a Game Boy",
    "Jam on a drum pad",
    "Take a trivia quiz about world geography",
  ] },
];

const STORAGE_KEY = "lite-canvas:threads:v1";
type State = { threads: Thread[]; selected: string | null; reports: Record<string, Report | null>; hydrated: boolean; open: boolean; quote: Quote | null };
type Action =
  | { type: "hydrate"; threads: Thread[]; selected: string | null }
  | { type: "thread"; thread: Thread }
  | { type: "select"; id: string }
  | { type: "message"; threadId: string; message: ChatMessage }
  | { type: "event"; threadId: string; event: CanvasEvent }
  | { type: "report"; threadId: string; report: Report | null }
  | { type: "quote"; quote: Quote | null }
  | { type: "open"; open: boolean };
const initial: State = { threads: [], selected: null, reports: {}, hydrated: false, open: true, quote: null };
// 대화를 전환해도 수신 이벤트는 화면에서 선택한 thread가 아닌 요청을 시작한 thread에 반영합니다.
function reducer(state: State, action: Action): State {
  if (action.type === "hydrate") return { ...state, threads: action.threads, selected: action.selected, hydrated: true };
  if (action.type === "thread") return { ...state, threads: [action.thread, ...state.threads], selected: action.thread.id, quote: null, open: true };
  if (action.type === "select") return { ...state, selected: action.id, quote: null, open: true };
  if (action.type === "quote") return { ...state, quote: action.quote };
  if (action.type === "open") return { ...state, open: action.open };
  if (action.type === "report") return { ...state, reports: { ...state.reports, [action.threadId]: action.report } };
  if (action.type === "message") return { ...state, threads: state.threads.map(t => t.id === action.threadId ? { ...t, title: t.messages.length === 0 ? action.message.content.slice(0, 30) : t.title, messages: [...t.messages, action.message] } : t) };
  const event = action.event;
  if (event.channel === "canvas") return { ...state,
    reports: { ...state.reports, [action.threadId]: reduceReport(state.reports[action.threadId] ?? null, event) },
    ...(event.type === "open" && state.selected === action.threadId ? { open: true, quote: null } : {}) };
  if (event.channel === "chat") return { ...state, threads: state.threads.map(thread => {
    if (thread.id !== action.threadId) return thread;
    return { ...thread, messages: reduceChat(thread.messages, event) };
  }) };
  return state;
}

export function Workspace() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [activity, setActivity] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const runLock = useRef(false);
  const thread = state.threads.find(t => t.id === state.selected);
  const report = state.selected ? state.reports[state.selected] : null;

  const reportStatus = report?.status;

  useEffect(() => {
    try {
      // 브라우저에는 대화 목록과 메시지를 보관하고 리포트의 최신 상태는 서버에서 별도로 조회합니다.
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const threads = Array.isArray(saved.threads) ? saved.threads.filter((t: Thread) => typeof t.id === "string" && Array.isArray(t.messages)) : [];
      dispatch({ type: "hydrate", threads, selected: threads.some((t: Thread) => t.id === saved.selected) ? saved.selected : threads[0]?.id ?? null });
    } catch { dispatch({ type: "hydrate", threads: [], selected: null }); }
  }, []);
  useEffect(() => {
    if (state.hydrated) try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ threads: state.threads, selected: state.selected })); } catch { /* Conversation remains usable when storage is full. */ }
  }, [state.threads, state.selected, state.hydrated]);
  useEffect(() => {
    // SSE 수신 중에는 조회를 멈추고 새로고침 후 생성 중인 리포트는 아래 폴링으로 복구합니다.
    if (!state.selected || running === state.selected) return;
    const controller = new AbortController();
    const id = state.selected;
    const refresh = () => fetch(`/api/threads/${id}/report`, { signal: controller.signal }).then(r => {
      if (!r.ok) throw new Error("리포트를 불러오지 못했습니다.");
      return r.json();
    }).then(({ report }) => {
      if (!controller.signal.aborted) dispatch({ type: "report", threadId: id, report });
    }).catch(e => {
      if (e.name !== "AbortError") setError(e.message);
    });
    void refresh();
    const polling = reportStatus && !["ready", "error"].includes(reportStatus) ? setInterval(refresh, 2000) : undefined;
    return () => { controller.abort(); clearInterval(polling); };
  }, [state.selected, running, reportStatus]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [thread?.messages]);

  function newThread() {
    const next: Thread = { id: crypto.randomUUID(), title: "새 대화", messages: [] };
    dispatch({ type: "thread", thread: next }); setDraft(""); setError("");
    input.current?.focus();
    return next;
  }
  // ref 잠금으로 연속 전송을 막습니다. 폼 문맥은 모델 입력에 포함하되 화면에는 사용자 질문만 보관합니다.
  async function send(text = draft, context?: unknown) {
    const message = text.trim();
    if (!message || runLock.current) return;
    runLock.current = true;
    const current = thread ?? newThread();
    const messageId = crypto.randomUUID();
    const quote = state.quote;
    dispatch({ type: "message", threadId: current.id, message: { id: messageId, role: "user", content: message, quote } });
    dispatch({ type: "quote", quote: null });
    setDraft(""); setError(""); setRunning(current.id); setActivity("메인 에이전트가 요청을 확인하고 있습니다");
    let finished = false;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: current.id, messageId, message: context ? buildMessage({ content: message, context }) : message, quote }) });
      if (!response.ok) throw new Error((await response.json()).error || "요청에 실패했습니다.");
      await consumeSse(response, (name, data) => {
        if (name === "error") throw new Error("에이전트 실행에 실패했습니다. 다시 시도해 주세요.");
        const event = (Array.isArray(data) ? data[data.length - 1] : data) as CanvasEvent;
        if (!event || typeof event !== "object" || !event.channel) return;
        if (event.channel === "run") {
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "ui_repairing") setActivity("UI 표현을 검증하고 수정하고 있습니다");
          if (event.type === "routed") setActivity(event.target === "supplier_ui" ? "공급업체 원문을 분석해 UI로 답변하고 있습니다" : event.target === "ui" ? "Intelligent UI를 구성하고 있습니다" : event.target === "answer" ? "리포트 문맥을 바탕으로 답변하고 있습니다" : "리포트 전문 에이전트에 연결했습니다");
        }
        if ((event.channel === "canvas" && ["ready", "error"].includes(event.type)) || (event.channel === "chat" && ["TEXT_MESSAGE_END", "message", "UI_ERROR"].includes(event.type))) finished = true;
        dispatch({ type: "event", threadId: current.id, event });
      });
      // 연결 종료 자체는 성공이 아닙니다. 채팅 또는 Canvas의 종료 이벤트를 받았는지 확인합니다.
      if (!finished) throw new Error("응답이 완료되기 전에 연결이 끊겼습니다. 현재 리포트를 다시 확인해 주세요.");
    } catch (e) { setError(e instanceof Error ? e.message : "요청에 실패했습니다."); }
    finally { setRunning(null); setActivity(""); runLock.current = false; }
  }

  return <main className={`canvas-workspace ${report && state.open ? "has-canvas" : ""}`}>
    <aside className="workspace-sidebar no-print">
      <Link className="workspace-brand" href="/"><FileChartColumn size={23} /><span>Lite Canvas<small>SUPPLIER INTELLIGENCE</small></span></Link>
      <button className="new-thread" onClick={newThread}><Plus size={17} />새 대화</button>
      <span className="sidebar-label">최근 대화</span>
      <nav aria-label="대화 목록">{state.threads.map(t => <button key={t.id} aria-current={t.id === state.selected ? "page" : undefined} onClick={() => { dispatch({ type: "select", id: t.id }); setError(""); }}>{t.title}</button>)}</nav>
      <p className="sidebar-note">공급업체1–8의 자료로<br />분석하고, 비교하고, 질문하세요.</p>
    </aside>
    <section id="workspace-chat" className="chat-panel no-print" aria-label="채팅">
      <header className="chat-heading"><div><span className="eyebrow">WORKSPACE</span><h1>{thread?.title || "공급업체 인사이트"}</h1></div><ThemeToggle />{report && !state.open && <button aria-label="Canvas 열기" onClick={() => dispatch({ type: "open", open: true })}><PanelRightOpen size={20} /></button>}</header>
      <div className="chat-messages" aria-live="polite">
        {!thread?.messages.length && <div className="chat-welcome"><div className="welcome-mark"><FileChartColumn size={28} /></div><span className="eyebrow">FROM QUESTION TO INSIGHT</span><h2>어떤 질문으로<br />시작해 볼까요?</h2><p>리포트부터 여행 지도까지 시각화하고,<br />궁금한 부분은 바로 이어서 물어보세요.</p><div className="starter-groups" aria-label="추천 질문">{STARTER_GROUPS.map(group => <details className="starter-group" key={group.title} open={group.open}>
          <summary>{group.title}<span>{group.questions.length}개</span></summary>
          <p>{group.description}</p>
          <div className="starter-list">{group.questions.map(text => <button key={text} disabled={!!running || !state.hydrated} onClick={() => send(text)}>{text}<ArrowUp size={15} aria-hidden="true" /></button>)}</div>
        </details>)}</div></div>}
        {thread?.messages.map(message => <article className={`chat-message ${message.role}`} key={message.id}><span className="message-author">{message.role === "user" ? "YOU" : "ANALYST"}</span>{message.quote && <div className="quote-badge" aria-label="인용된 리포트"><MessageSquareQuote size={14} /><span>{message.quote.text}</span></div>}{message.format === "openui" ? <ChatUI message={message} onSend={(text, context) => { void send(text, context); }} /> : <div className="message-content">{message.content || "…"}</div>}</article>)}
        {running === state.selected && <p className="chat-activity" role="status"><span className="pulse" />{activity}</p>}<div ref={end} />
      </div>
      <form className="chat-composer" onSubmit={e => { e.preventDefault(); void send(); }}>
        {error && <p role="alert" className="error-notice">{error}</p>}
        {state.quote && <div className="quote-badge pending-quote" aria-label="질문할 인용"><MessageSquareQuote size={16} /><span>{state.quote.text}</span><button type="button" aria-label="인용 제거" onClick={() => dispatch({ type: "quote", quote: null })}><X size={14} /></button></div>}
        <div className="composer-input"><textarea ref={input} value={draft} onChange={e => setDraft(e.target.value)} placeholder={state.quote ? "선택한 내용에 대해 질문하세요" : "공급업체 리포트를 요청하거나 질문하세요"} aria-label="채팅 메시지" rows={2} maxLength={20000} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><button type="submit" aria-label="메시지 보내기" disabled={!draft.trim() || !!running || !state.hydrated}><ArrowUp size={19} /></button></div>
        <p className="composer-hint">Enter로 보내기 · Shift+Enter로 줄바꿈</p>
      </form>
    </section>
    {report && state.open && <CanvasSplitter />}
    {report && state.open && <ReportView key={report.id} report={report} onClose={() => dispatch({ type: "open", open: false })} onQuote={quote => { dispatch({ type: "quote", quote }); input.current?.focus(); }} />}
  </main>;
}
