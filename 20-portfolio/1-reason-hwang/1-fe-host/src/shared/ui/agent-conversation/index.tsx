"use client";

import {
  AgentInterface,
  type AgentInterfaceProps,
  type ChatLLM,
  useThread,
  useThreadList,
} from "@openuidev/react-ui";
import { History, MessageSquarePlus, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useHostTheme } from "@/shared/lib/theme";
import { OutputView } from "@/shared/ui/intelligent-ui";
import "@openuidev/react-ui/styles/index.css";
import "@/shared/ui/intelligent-ui/components/components.css";
import "@/shared/ui/intelligent-ui/components/theme.css";
import "./agent-conversation.css";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  view?: ReactNode;
};

type ConversationPresentation = {
  title: string;
  description?: string;
  welcomeTitle?: string;
  starters?: { displayText: string; prompt: string }[];
  placeholder?: string;
  toolbar?: ReactNode;
  headerControls?: ReactNode;
  headerLeading?: ReactNode;
  composer?: ReactNode;
  status?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  busy?: boolean;
  onCancel?: () => void;
  onReset?: () => void | Promise<void>;
  resetLabel?: string;
};

export type AgentChatFrameProps = ConversationPresentation & Pick<
  AgentInterfaceProps,
  "llm" | "storage" | "componentLibrary" | "onAction" | "components"
> & { history?: boolean };

/** Shared prose rendering uses the same safe Markdown catalog as rich answers. */
export function ConversationText({ text }: { text: string }) {
  return <div className="agent-conversation__prose">
    <OutputView program={`root = Col([Markdown(${JSON.stringify(text)})])`} />
  </div>;
}

export function ChatNotice({ children, tone = "info" }: {
  children: ReactNode;
  tone?: "info" | "error" | "status";
}) {
  return <div className={`agent-chat-notice agent-chat-notice--${tone}`} role={tone === "error" ? "alert" : tone === "status" ? "status" : undefined}>{children}</div>;
}

function ConversationActions({ busy, history, onReset, onDidReset, resetLabel = "새 대화" }: {
  busy: boolean;
  history: boolean;
  onReset?: () => void | Promise<void>;
  onDidReset: () => void;
  resetLabel?: string;
}) {
  const running = useThread(state => state.isRunning);
  const cancelMessage = useThread(state => state.cancelMessage);
  const switchToNewThread = useThreadList(state => state.switchToNewThread);

  async function reset() {
    if (busy || running) return;
    cancelMessage();
    if (onReset) await onReset();
    else switchToNewThread();
    onDidReset();
  }

  return <div className="agent-conversation__actions">
    {history && <details className="agent-conversation__history">
      <summary><History size={15} aria-hidden="true" />대화 기록</summary>
      <div className="agent-conversation__history-panel"><AgentInterface.ThreadList /></div>
    </details>}
    <button type="button" onClick={() => void reset()} disabled={busy || running}>
      <MessageSquarePlus size={15} aria-hidden="true" />{resetLabel}
    </button>
  </div>;
}

function DomainComposer({ busy, onCancel, placeholder, epoch, hideStarters = false }: {
  busy: boolean;
  onCancel?: () => void;
  placeholder: string;
  epoch: number;
  hideStarters?: boolean;
}) {
  const running = useThread(state => state.isRunning);
  const externalRun = busy && !running;
  return <>
    <fieldset disabled={externalRun} className="agent-conversation__composer-fieldset">
      <AgentInterface.Composer key={epoch} placeholder={placeholder} starters={hideStarters ? [] : undefined} />
    </fieldset>
    {externalRun && <button className="agent-conversation__cancel" type="button" onClick={onCancel}>
      <Square size={14} aria-hidden="true" />답변 중단
    </button>}
  </>;
}

/** One shell for native AG-UI transports and domain-controlled conversations. */
export function AgentChatFrame({ title, description, welcomeTitle, starters, toolbar, status, footer,
  children, busy = false, onCancel, onReset, placeholder, history = false, headerControls, headerLeading, composer, resetLabel, ...agentProps }: AgentChatFrameProps) {
  const [mounted, setMounted] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const { mode } = useHostTheme();
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return <section className={`agent-conversation${headerControls ? " agent-conversation--compact" : ""}`} data-slot="agent-chat-frame" aria-label={title}>
    {toolbar && <div className="agent-conversation__toolbar">{toolbar}</div>}
    {status && <div className="agent-conversation__status">{status}</div>}
    <div className="agent-conversation__interface">
      <AgentInterface {...agentProps} theme={{ mode }} agentName={title} starters={starters} starterVariant="card" scrollVariant="always">
        <AgentInterface.Sidebar>{null}</AgentInterface.Sidebar>
        <AgentInterface.ThreadHeader
          start={<div className="agent-conversation__header-start">{headerLeading}<div className="agent-conversation__heading"><h1 className="agent-conversation__title">{title}</h1>{!headerControls && description && <span className="agent-conversation__description">{description}</span>}</div></div>}
          center={headerControls}
          showChatTitle={false} showChatActions={false}
          end={<ConversationActions busy={busy} history={history} onReset={onReset} resetLabel={resetLabel} onDidReset={() => setEpoch(value => value + 1)} />}
        />
        <AgentInterface.MobileHeader>
          <div className="agent-conversation__header-start">{headerLeading}<div className="agent-conversation__heading"><h1 className="agent-conversation__title">{title}</h1>{!headerControls && description && <span className="agent-conversation__description">{description}</span>}</div></div>
          <ConversationActions busy={busy} history={history} onReset={onReset} resetLabel={resetLabel} onDidReset={() => setEpoch(value => value + 1)} />
          {headerControls && <div className="agent-conversation__mobile-controls">{headerControls}</div>}
        </AgentInterface.MobileHeader>
        {!busy && <AgentInterface.Welcome key={epoch} title={welcomeTitle ?? "무엇을 도와드릴까요?"} description={description} starterVariant="card" />}
        <AgentInterface.Composer>{composer ?? <DomainComposer busy={busy} onCancel={onCancel} placeholder={placeholder ?? "메시지를 입력하세요"} hideStarters={!!headerControls} epoch={epoch} />}</AgentInterface.Composer>
        {children}
      </AgentInterface>
    </div>
    {footer && <div className="agent-conversation__footer">{footer}</div>}
  </section>;
}

function SyncMessages({ messages }: { messages: ConversationMessage[] }) {
  const setMessages = useThread(state => state.setMessages);
  useEffect(() => {
    setMessages(messages.map(({ id, role, content }) => ({ id, role, content })));
  }, [messages, setMessages]);
  return null;
}

/** Domain controllers keep validated results; the shared frame owns all chrome. */
export function AgentConversation({ messages, onSend, children, ...presentation }: ConversationPresentation & {
  messages: ConversationMessage[];
  onSend: (text: string) => Promise<void>;
}) {
  const latest = useRef({ onSend, onCancel: presentation.onCancel, messages });
  latest.current = { onSend, onCancel: presentation.onCancel, messages };
  const llm = useMemo<ChatLLM>(() => ({
    async send({ messages: input, signal }) {
      const cancel = () => latest.current.onCancel?.();
      if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
      signal.addEventListener("abort", cancel, { once: true });
      try {
        const content = input.at(-1)?.content;
        if (typeof content === "string") await latest.current.onSend(content);
        return new Response(null, { status: 200 });
      } finally {
        signal.removeEventListener("abort", cancel);
      }
    },
    streamProtocol: { async *parse() { /* Domain adapters already consume the stream. */ } },
  }), []);
  const components = useMemo(() => ({
    AssistantMessage: ({ message }: { message: { id: string; content?: string } }) => <div className="agent-conversation__answer">
      {latest.current.messages.find(item => item.id === message.id)?.view ?? <ConversationText text={message.content ?? ""} />}
    </div>,
  }), []);

  return <AgentChatFrame {...presentation} llm={llm} components={components}>
    <SyncMessages messages={messages} />
    {children}
  </AgentChatFrame>;
}
