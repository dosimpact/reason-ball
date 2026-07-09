"use client";

import { Bot, User } from "lucide-react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { ChatMessage } from "@/features/chat/model/chatTypes";

type ChatMessageListProps = {
  messages: ChatMessage[];
};

export function ChatMessageList({ messages }: ChatMessageListProps) {
  return (
    <MessageScrollerProvider>
      <MessageScroller className="min-h-[28rem] rounded-lg border bg-card">
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
        <MessageFooter>
          {message.status === "streaming" ? "Generating response..." : message.status}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
