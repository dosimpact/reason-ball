"use client";

import { ChatComposer } from "@/features/chat/ui/ChatComposer";
import { ChatMessageList } from "@/features/chat/ui/ChatMessageList";
import { ChatStatusBar } from "@/features/chat/ui/ChatStatusBar";
import { useChat } from "@/features/chat/context/useChat";

export function ChatPage() {
  const { error, messages, resetThread, sendMessage, status } = useChat();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <header className="border-b pb-5">
        <p className="text-sm font-medium text-muted-foreground">LangGraph</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
          Chat
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Text-only chat UI backed by the LangGraph standard API.
        </p>
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
