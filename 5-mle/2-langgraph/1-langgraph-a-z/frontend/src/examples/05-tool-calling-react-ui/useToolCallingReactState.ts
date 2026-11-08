import { useState } from "react";
import { StreamLogEntry, createClientId } from "../../lib/langgraphClient";
import {
  ChatItem,
  MessageStreamData,
  StreamMessage,
  ToolCard,
  contentToText,
  latestToolCard,
  messageFromStream,
  samplePrompts,
  toolArgsOf,
  toolCallIdOf,
  toolCallsFromMessage,
  toolNameOf,
  upsertToolCall,
} from "./data";

// Local state is separate from SDK requests and rendering.
export function useToolCallingReactState() {
  const [threadId, setThreadId] = useState("");
  const [prompt, setPrompt] = useState(samplePrompts[0]);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [toolCards, setToolCards] = useState<ToolCard[]>([]);
  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    setThreadId("");
    setMessages([]);
    setToolCards([]);
    setStatus("Idle");
    setEvents([]);
    setError("");
  }

  function handleStreamMessages(streamMessages: StreamMessage[]) {
    for (const message of streamMessages) {
      const type = String(message.type ?? message.role ?? "").toLowerCase();
      const text = contentToText(message.content);

      if (type.includes("ai") || type === "assistant") {
        const calls = toolCallsFromMessage(message);
        if (calls.length > 0) {
          if (text) {
            setMessages((current) => [
              ...current,
              {
                id: String(message.id ?? createClientId("message")),
                role: "assistant",
                content: text,
              },
            ]);
          }
          setToolCards((current) =>
            calls.reduce((cards, call, index) => {
              const id = toolCallIdOf(call, `tool-${index}`);
              return upsertToolCall(cards, {
                id,
                name: toolNameOf(call),
                args: toolArgsOf(call),
                status: "running",
              });
            }, current),
          );
        }
      }

      if (type.includes("tool")) {
        const toolCallId = String(message.tool_call_id ?? message.id ?? "");
        const result = text || JSON.stringify(message.content ?? "");

        setToolCards((current) => {
          const existing = latestToolCard(current, toolCallId);
          return upsertToolCall(current, {
            id: toolCallId || existing?.id || createClientId("tool"),
            name: String(message.name ?? existing?.name ?? "tool"),
            args: existing?.args,
            status: result.toLowerCase().startsWith("error")
              ? "error"
              : "success",
            result,
            error: result.toLowerCase().startsWith("error")
              ? result
              : undefined,
          });
        });
      }
    }
  }

  function handleMessageStream(data: MessageStreamData) {
    const message = messageFromStream(data);
    if (!message) return;

    const type = String(message.type ?? message.role ?? "").toLowerCase();
    if (!type.includes("ai") && type !== "assistant") return;

    const text = contentToText(message.content);
    if (!text) return;

    const id = String(message.id ?? "streaming-assistant-message");
    setMessages((current) => {
      const existing = current.findIndex((item) => item.id === id);
      if (existing < 0) {
        return [...current, { id, role: "assistant", content: text }];
      }
      return current.map((item, index) =>
        index === existing
          ? { ...item, content: `${item.content}${text}` }
          : item,
      );
    });
  }

  return {
    threadId,
    setThreadId,
    prompt,
    setPrompt,
    messages,
    setMessages,
    toolCards,
    setToolCards,
    status,
    setStatus,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
    handleStreamMessages,
    handleMessageStream,
  };
}
