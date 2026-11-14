"use client";

import { AgentInterface, type ChatLLM, useThread } from "@openuidev/react-ui";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useHostTheme } from "@/shared/lib/theme";
import "@openuidev/react-ui/styles/index.css";
import "./agent-conversation.css";

export type ConversationMessage = { id: string; role: "user" | "assistant"; content: string; view?: ReactNode };

function SyncMessages({ messages }: { messages: ConversationMessage[] }) {
  const setMessages = useThread(state => state.setMessages);
  useEffect(() => { setMessages(messages.map(({ id, role, content }) => ({ id, role, content }))); }, [messages, setMessages]);
  return null;
}

function DomainComposer({ busy, onCancel, placeholder, epoch }: { busy: boolean; onCancel?: () => void; placeholder: string; epoch: number }) {
  const running = useThread(state => state.isRunning);
  const externalRun = busy && !running;
  return <><fieldset disabled={externalRun} className="min-w-0 border-0 p-0"><AgentInterface.Composer key={epoch} placeholder={placeholder} /></fieldset>{externalRun && <button onClick={onCancel}>답변 중단</button>}</>;
}

/** Domain controllers retain their validated results; OpenUI owns the chat UI. */
export function AgentConversation({ title, messages, onSend, onCancel, onReset, children, busy = false, welcomeTitle, starters, placeholder = "메시지를 입력하세요" }: {
  title: string; messages: ConversationMessage[]; onSend: (text: string) => Promise<void>;
  welcomeTitle?: string; starters?: { displayText: string; prompt: string }[]; busy?: boolean; onCancel?: () => void; onReset?: () => void; children?: ReactNode; placeholder?: string;
}) {
  const [epoch, setEpoch] = useState(0);
  const reset = () => { if (!busy) { onReset?.(); setEpoch(value => value + 1); } };
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { mode } = useHostTheme();
  const latest = useRef({ onSend, onCancel, messages });
  latest.current = { onSend, onCancel, messages };
  const llm = useMemo<ChatLLM>(() => ({
    async send({ messages: input, signal }) {
      const cancel = () => latest.current.onCancel?.();
      signal.addEventListener("abort", cancel, { once: true });
      try {
        const content = input.at(-1)?.content;
        if (typeof content === "string") await latest.current.onSend(content);
        return new Response(null, { status: 200 });
      } finally { signal.removeEventListener("abort", cancel); }
    },
    streamProtocol: { async *parse() { /* Domain adapters already consume the stream. */ } },
  }), []);
  const components = useMemo(() => ({
    AssistantMessage: ({ message }: { message: { id: string; content?: string } }) => <>{latest.current.messages.find(item => item.id === message.id)?.view ?? message.content}</>,
  }), []);
  if (!mounted) return null;
  return <div className="agent-conversation">
    <AgentInterface llm={llm} theme={{ mode }} agentName={title} starters={starters} components={components}>
      <SyncMessages messages={messages} />
      <AgentInterface.Sidebar>{null}</AgentInterface.Sidebar>
      <AgentInterface.ThreadHeader showChatTitle={false} showChatActions={false} start={title} end={onReset && <button disabled={busy} onClick={reset}>새 대화</button>} />
      <AgentInterface.MobileHeader>{title}{onReset && <button disabled={busy} onClick={reset}>새 대화</button>}</AgentInterface.MobileHeader>
      {welcomeTitle && <AgentInterface.Welcome key={epoch} title={welcomeTitle} />}
      <AgentInterface.Composer><DomainComposer busy={busy} onCancel={onCancel} placeholder={placeholder} epoch={epoch} /></AgentInterface.Composer>
      {children}
    </AgentInterface>
  </div>;
}
