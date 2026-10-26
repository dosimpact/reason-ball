"use client";
import { useContext } from "react";
import type { Message } from "@openuidev/react-headless";
import { Renderer } from "@openuidev/react-lang";
import { dashboardLibrary, ArtifactContext } from "@/entities/dashboard";
import { runLibraryAction } from "@/shared/ui/openui";
import { ToolActivities } from "./tool-activities";
export function ChatMessage({
  message,
  messages,
  streaming,
  send,
}: {
  message: Message;
  messages: Message[];
  streaming: boolean;
  send: (text: string) => void;
}) {
  const host = useContext(ArtifactContext);
  const content = "content" in message ? message.content : "";
  const text = typeof content === "string" ? content : "";
  if (!text)
    return message.role === "assistant" ? (
      <ToolActivities
        message={message}
        messages={messages}
        running={streaming}
      />
    ) : null;
  return (
    <article className={`chat-message role-${message.role}`}>
      {message.role === "assistant" && (
        <ToolActivities
          message={message}
          messages={messages}
          running={streaming}
        />
      )}
      <div className="message-label">
        {message.role === "user" ? "YOU" : "FILING STUDIO"}
      </div>
      {message.role === "user" ? (
        <p>{text}</p>
      ) : /^\s*(?:root\s*=|\$?[A-Za-z_]\w*\s*=)/m.test(text) ? (
        <Renderer
          library={dashboardLibrary}
          response={text}
          isStreaming={streaming}
          onAction={(event) => {
            if (event.type === "FocusPanel") {
              host.focus(String((event.params as { panelId: string }).panelId));
              return;
            }
            const handled = runLibraryAction(event);
            if (handled === null && event.humanFriendlyMessage)
              send(event.humanFriendlyMessage);
          }}
        />
      ) : (
        <p className="plain-answer">{text}</p>
      )}
    </article>
  );
}
