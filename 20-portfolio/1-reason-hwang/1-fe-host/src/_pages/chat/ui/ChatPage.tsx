"use client";

import { GraphSelector } from "@/_pages/chat/ui/GraphSelector";
import { ChatComposer } from "@/_pages/chat/ui/ChatComposer";
import { ChatMessageList } from "@/_pages/chat/ui/ChatMessageList";
import { ChatStatusBar } from "@/_pages/chat/ui/ChatStatusBar";
import { useChat } from "@/_pages/chat/model/context/useChat";

export function ChatPage() {
  const { error, messages, resetThread, sendMessage, status, graphId, graphs, selectGraph } = useChat();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <header className="border-b pb-5">
        <p className="text-sm font-medium text-muted-foreground">LangGraph</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
          Chat
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          에이전트를 선택하고 대화하세요. 기술적 분석은 일봉·주봉과 RSI·SMA·MACD를 지원합니다.
        </p>
        <GraphSelector graphs={graphs} value={graphId} onChange={selectGraph} disabled={status === "streaming" || status === "creating_thread"} />
      </header>

      <ChatStatusBar error={error} status={status} />
      <ChatMessageList messages={messages} />
      <ChatComposer
        status={status}
        onReset={resetThread}
        onSendMessage={sendMessage}
      />
    </div>
  );
}
