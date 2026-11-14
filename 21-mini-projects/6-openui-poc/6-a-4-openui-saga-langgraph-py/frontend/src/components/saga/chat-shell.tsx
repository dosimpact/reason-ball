"use client";

import { Alert, Button, Input, TextArea } from "@grafana/ui";
import { ChatProvider, agUIAdapter, fetchLLM, useThread, useThreadList, type Message } from "@openuidev/react-headless";
import { Renderer, buildMessage, parseMessage, type OpenUIError } from "@openuidev/react-lang";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, CircleHelp, Layers3, MessageSquare, Moon, Plus, Search, Sparkles, Square, Sun, Trash2 } from "lucide-react";
import { ChatHistory, localChatStorage } from "@/lib/chat-storage";
import { sagaChatLibrary } from "@/lib/saga-genui";
import { useSagaTheme } from "./theme";

const starters = [
  { title: "Service health overview", description: "Monitor latency, traffic and error budgets", prompt: "Create a service health dashboard with sample latency, request traffic, error rate stats, status badges and a service comparison table. Clearly label all values as sample data." },
  { title: "Plan your next release", description: "Turn milestones into a clear delivery plan", prompt: "Create a release planning workspace using Grafana Saga cards, alerts, a milestone table and a release preferences form. Use sample data." },
  { title: "Explore product metrics", description: "Make sense of growth and engagement", prompt: "Create a product analytics overview with sample growth metrics, a chart, a comparison table and follow-up actions. Label sample data." },
  { title: "Build an incident brief", description: "Bring timeline, impact and actions together", prompt: "Build a sample incident brief with a warning alert, service status, incident timeline table and a follow-up action form. Label it as fictional sample data." },
];

function readStoredMessage(raw: string, streaming = false) {
  const parsed = parseMessage(raw, { streaming });
  if (raw.includes("]]>openui:")) return parsed;
  let content = parsed.content;
  let context = parsed.context;
  const match = content.match(/<context>([\s\S]*)<\/context>\s*$/);
  if (match) {
    try { context = JSON.parse(match[1]); } catch { context = null; }
    content = content.slice(0, match.index).trimEnd();
  }
  content = content.match(/^<content[^>]*>([\s\S]*)<\/content>\s*$/)?.[1] ?? content;
  return { ...parsed, content, context };
}

function AssistantContent({ message, streaming }: { message: Message; streaming: boolean }) {
  const processMessage = useThread(s => s.processMessage);
  const updateMessage = useThread(s => s.updateMessage);
  const raw = typeof message.content === "string" ? message.content : "";
  const [renderFailure, setRenderFailure] = useState<{ response: string; signature: string; errors: OpenUIError[] } | null>(null);
  const parsed = useMemo(() => readStoredMessage(raw, streaming), [raw, streaming]);
  const context = parsed.context;
  const initialState = Array.isArray(context) && typeof context[0] === "object" ? context[0] : context && typeof context === "object" && !Array.isArray(context) ? context : undefined;
  if (!raw) return null;
  return <><Renderer response={parsed.content} library={sagaChatLibrary} isStreaming={streaming} initialState={initialState as Record<string, unknown> | undefined}
    onError={errors => {
      const failures = errors.filter(error => error.severity !== "warning");
      const signature = JSON.stringify(failures);
      setRenderFailure(previous => previous?.response === raw && previous.signature === signature ? previous : { response: raw, signature, errors: failures });
    }}
    onStateUpdate={state => updateMessage({ ...message, content: buildMessage({ content: parsed.content, attributes: parsed.attributes, context: Object.keys(state).length ? [state] : undefined }) } as Message)}
    onAction={event => {
      if (event.type === "continue_conversation") {
        const context: unknown[] = [`User clicked: ${event.humanFriendlyMessage}`];
        if (event.formState || event.params?.context !== undefined) context.push(event.formState ?? {});
        if (event.params?.context !== undefined) context.push(event.params.context);
        void processMessage({ role: "user", content: buildMessage({ content: event.humanFriendlyMessage, context }) });
      } else if (event.type === "open_url" && typeof event.params?.url === "string") {
        const url = new URL(event.params.url, window.location.origin);
        if (["https:", "http:"].includes(url.protocol)) window.open(url.href, "_blank", "noopener,noreferrer");
      }
    }} />{renderFailure?.response === raw && renderFailure.errors.length > 0 && <Alert title="This interface could not be rendered" severity="error"><ul>{renderFailure.errors.map((error, index) => <li key={index}>{error.message}</li>)}</ul></Alert>}</>;
}

function Workspace() {
  const { mode, toggleTheme } = useSagaTheme();
  const threads = useThreadList(s => s.threads);
  const loadThreads = useThreadList(s => s.loadThreads);
  useEffect(() => { loadThreads(); }, [loadThreads]);
  const selected = useThreadList(s => s.selectedThreadId);
  const select = useThreadList(s => s.selectThread);
  const newChat = useThreadList(s => s.switchToNewThread);
  const deleteThread = useThreadList(s => s.deleteThread);
  const messages = useThread(s => s.messages);
  const running = useThread(s => s.isRunning);
  const loading = useThread(s => s.isLoadingMessages);
  const error = useThread(s => s.threadError);
  const processMessage = useThread(s => s.processMessage);
  const cancel = useThread(s => s.cancelMessage);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, running]);
  const send = (content: string) => { if (!content.trim() || running) return; setDraft(""); void processMessage({ role: "user", content }); };
  const currentTitle = threads.find(t => t.id === selected)?.title ?? "New conversation";
  const lastAssistant = messages.findLast(m => m.role === "assistant")?.id;
  return <div className="saga-workspace">
    <aside className="saga-sidebar" aria-label="Conversation sidebar">
      <Link href="/" className="saga-brand"><span className="saga-brand-mark"><Layers3 size={22}/></span><span>Saga<span className="saga-brand-caption">GENERATIVE WORKSPACE</span></span></Link>
      <Button fullWidth variant="primary" onClick={newChat} icon={<span><Plus size={16}/></span>}>New conversation</Button>
      <div className="saga-search"><Input aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={e => setQuery(e.currentTarget.value)} prefix={<Search size={15}/>}/></div>
      <div className="saga-sidebar-label">YOUR CONVERSATIONS <span>{threads.length.toString().padStart(2, "0")}</span></div>
      <nav className="saga-history" aria-label="Chat history">{threads.filter(t => t.title.toLowerCase().includes(query.toLowerCase())).map(thread => <div className={`saga-history-row ${selected === thread.id ? "is-selected" : ""}`} key={thread.id}>
        <Button variant="secondary" fill="text" onClick={() => select(thread.id)} aria-current={selected === thread.id ? "page" : undefined} icon={<span><MessageSquare size={15}/></span>}>{thread.title}</Button>
        <Button variant="secondary" fill="text" aria-label={`Delete ${thread.title}`} onClick={() => deleteThread(thread.id)} icon={<span><Trash2 size={13}/></span>}/>
      </div>)}</nav>
      <div className="saga-sidebar-footer"><Link href="/gallery"><Layers3 size={16}/>Component gallery <span>↗</span></Link><div className="saga-local-note"><span className="saga-status-dot"/>Local workspace <span>v1.0</span></div></div>
    </aside>
    <main className="saga-main">
      <header className="saga-topbar"><div><span className="saga-breadcrumb">Workspace</span><span className="saga-slash">/</span><span>{currentTitle}</span></div><div className="saga-header-actions"><span className="saga-runtime"><span className="saga-status-dot"/>Python LangGraph</span><Button fill="text" variant="secondary" aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} theme`} onClick={toggleTheme} icon={<span>{mode === "dark" ? <Sun size={17}/> : <Moon size={17}/>}</span>}/></div></header>
      <div className="saga-scroll-region">
        {messages.length === 0 && !loading ? <section className="saga-welcome"><div className="saga-eyebrow"><Sparkles size={14}/> IDEAS INTO INTERFACES</div><h1>What would you like<br/>to explore today?</h1><p>Ask a question. Bring your data. Build something useful.<br/>Your workspace takes shape as you think.</p><div className="saga-starters">{starters.map((starter, i) => <button className="saga-starter" key={starter.title} disabled={running} onClick={() => send(starter.prompt)}><span className="saga-starter-number">0{i + 1}</span><strong>{starter.title}</strong><span>{starter.description}</span><ArrowUp size={17}/></button>)}</div><div className="saga-welcome-note"><CircleHelp size={14}/> Powered by OpenUI, Grafana Saga and Python LangGraph</div></section> : <div className="saga-messages" aria-live="polite">{selected?.startsWith("saga-demo-") && <div className="saga-demo-note">Handcrafted offline example · sample data · no model call on page load</div>}{messages.map(message => {
          if (message.role === "tool") return <details className="saga-tool" key={message.id}><summary>Tool result</summary><pre>{typeof message.content === "string" ? message.content : JSON.stringify(message.content)}</pre></details>;
          if (message.role !== "user" && message.role !== "assistant") return null;
          const content = typeof message.content === "string" ? parseMessage(message.content).content : "";
          return <article className={`saga-message saga-message-${message.role}`} key={message.id}><div className="saga-message-label">{message.role === "user" ? "You" : <><span className="saga-assistant-mark"><Layers3 size={13}/></span>Saga</>}</div>{message.role === "assistant" ? <AssistantContent message={message} streaming={running && lastAssistant === message.id}/> : <div className="saga-user-content">{content}</div>}{message.role === "assistant" && "toolCalls" in message && message.toolCalls?.map(call => <div key={call.id} className="saga-tool-label">Tool · {call.function.name}</div>)}</article>;
        })}{(loading || running) && <div className="saga-running"><span className="saga-status-dot"/>{loading ? "Loading conversation…" : "Generating your interface…"}</div>}<div ref={bottom}/></div>}
        {error && <div className="saga-error"><Alert title="Unable to complete the response" severity="error">{error.message}</Alert></div>}
      </div>
      <footer className="saga-composer-region"><form className="saga-composer" onSubmit={e => { e.preventDefault(); send(draft); }}><TextArea aria-label="Message Saga" placeholder="Describe what you want to create…" value={draft} rows={2} onChange={e => setDraft(e.currentTarget.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }}/><div className="saga-composer-bottom"><span><Sparkles size={13}/>OpenUI + Saga</span>{running ? <Button aria-label="Stop generation" variant="secondary" onClick={cancel} icon={<span><Square size={14}/></span>}>Stop</Button> : <Button type="submit" aria-label="Send message" disabled={!draft.trim()} icon={<span><ArrowUp size={17}/></span>}/>}</div></form><div className="saga-composer-hint">Enter to send · Shift + Enter for a new line <span>Generated content may be inaccurate. Tools use sample data.</span></div></footer>
    </main><ChatHistory/>
  </div>;
}

export function SagaChatShell() {
  const storage = useMemo(() => localChatStorage(), []);
  const llm = useMemo(() => fetchLLM({ url: "/api/chat", streamAdapter: agUIAdapter() }), []);
  return <ChatProvider storage={storage} llm={llm}><Workspace/></ChatProvider>;
}
