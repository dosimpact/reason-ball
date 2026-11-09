"use client";

import { useState } from "react";
import { OutputView } from "@/shared/ui/intelligent-ui";
import { Bot, User } from "lucide-react";

import { Bubble, BubbleContent } from "@/shared/ui/bubble";
import { Marker, MarkerContent } from "@/shared/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/shared/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/shared/ui/message-scroller";
import type { ChatMessage } from "@/_pages/chat/model/chatTypes";

type ChatMessageListProps = {
  messages: ChatMessage[];
};

export function ChatMessageList({ messages }: ChatMessageListProps) {
  return (
    <MessageScrollerProvider>
      <MessageScroller className="h-[60vh] min-h-80 shrink-0 rounded-lg border bg-card">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-4 p-4">
            {messages.length === 0 ? (
              <MessageScrollerItem>
                <Marker variant="separator">
                  <MarkerContent>Start a LangGraph chat</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            ) : null}

            {messages.map((message) => (
              <MessageScrollerItem
                key={message.id}
                scrollAnchor={message.status === "streaming"}
              >
                <ChatMessageRow message={message} />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

function ChatMessageRow({ message }: { message: ChatMessage }) {
  const [renderError, setRenderError] = useState(false);
  const isUser = message.role === "user";

  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageAvatar className="size-8">
        {isUser ? (
          <User className="size-4" aria-hidden="true" />
        ) : (
          <Bot className="size-4" aria-hidden="true" />
        )}
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>{isUser ? "You" : "Assistant"}</MessageHeader>
        <Bubble align={isUser ? "end" : "start"} variant={isUser ? "default" : "secondary"}>
          <BubbleContent className="whitespace-pre-wrap text-sm leading-6">
            {message.content || "Thinking..."}
          </BubbleContent>
        </Bubble>
        {message.program && !renderError ? <div className="w-full min-w-0 rounded-lg border bg-background p-4" data-testid="technical-analysis-output">
          <OutputView key={message.presentationId} program={message.program} onError={() => setRenderError(true)} />
        </div> : null}
        {renderError ? <p role="alert">차트를 표시하지 못했습니다. 위 분석 설명을 확인하세요.</p> : null}
        <MessageFooter>
          {message.status === "streaming" ? "Generating response..." : message.status}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
