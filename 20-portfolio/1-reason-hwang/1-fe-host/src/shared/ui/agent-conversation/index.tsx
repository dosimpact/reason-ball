"use client";

import { AgentInterface, type ChatLLM, useThread } from "@openuidev/react-ui";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useHostTheme } from "@/shared/lib/theme";
import "@openuidev/react-ui/styles/index.css";

export type ConversationMessage = { id: string; role: "user" | "assistant"; content: string; view?: ReactNode };

function SyncMessages({ messages }: { messages: ConversationMessage[] }) {
  const setMessages = useThread(state => state.setMessages);
  useEffect(() => { setMessages(messages.map(({ id, role, content }) => ({ id, role, content }))); }, [messages, setMessages]);
  return null;
}

/** Domain controllers retain their validated results; OpenUI owns the chat UI. */
export function AgentConversation({ title, messages, onSend, onCancel, onReset, children, placeholder = "메시지를 입력하세요" }: {
  title: string; messages: ConversationMessage[]; onSend: (text: string) => Promise<void>;
  onCancel?: () => void; onReset?: () => void; children?: ReactNode; placeholder?: string;
}) {
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
  return <div className="min-h-[600px] h-[80vh] w-full">
    <AgentInterface llm={llm} theme={{ mode }} agentName={title} components={components}>
      <SyncMessages messages={messages} />
      <AgentInterface.Sidebar>{null}</AgentInterface.Sidebar>
      <AgentInterface.ThreadHeader showChatTitle={false} showChatActions={false} start={title} end={onReset && <button onClick={onReset}>새 대화</button>} />
      <AgentInterface.MobileHeader>{title}</AgentInterface.MobileHeader>
      <AgentInterface.Composer placeholder={placeholder} />
      {children}
    </AgentInterface>
  </div>;
}
