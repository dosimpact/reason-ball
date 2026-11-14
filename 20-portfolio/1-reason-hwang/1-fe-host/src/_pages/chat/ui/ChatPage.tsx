"use client";

import { ChatActivity } from "./ChatActivity";
import { GraphSelector } from "./GraphSelector";
import { AgentConversation, ChatNotice, ConversationText } from "@/shared/ui/agent-conversation";
import { OutputView } from "@/shared/ui/intelligent-ui";
import { useChat } from "../model/context/useChat";

export function ChatPage() {
  const { error, messages, resetThread, cancelRun, sendMessage, status, graphId, graphs, selectGraph } = useChat();
  const busy = status === "streaming" || status === "creating_thread";
  return <AgentConversation key={graphId} title="Chat" welcomeTitle="무엇을 도와드릴까요?"
    description="에이전트를 선택하고 대화하세요. 기술적 분석은 일봉·주봉과 RSI·SMA·MACD를 지원합니다."
    toolbar={<GraphSelector graphs={graphs} value={graphId} onChange={selectGraph} disabled={busy} />}
    status={<ChatNotice tone={error ? "error" : "status"}>{error ?? (busy ? "답변을 준비하고 있어요" : "Ready")}</ChatNotice>}
    busy={busy} messages={messages.map((message, index) => ({
      id: message.id, role: message.role === "user" ? "user" as const : "assistant" as const,
      content: message.content,
      view: <div><ChatActivity activities={message.activities} streaming={message.status === "streaming"} />{message.content && <ConversationText text={message.content} />}{message.program && <OutputView program={message.program} active={!busy && index === messages.length - 1} />}</div>,
    }))} onSend={sendMessage} onCancel={cancelRun} onReset={resetThread} />;
}
