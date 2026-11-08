import { useState } from "react";
import { createClientId, StreamLogEntry } from "../../lib/langgraphClient";
import { Conversation } from "./data";

// Local state is separate from SDK requests and rendering.
export function useBasicChatReactHookState() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("My project code is cobalt.");
  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  function addEvent(event: string, data: unknown, runId?: string) {
    setEvents((current) =>
      [
        {
          id: createClientId("stream"),
          event,
          runId,
          data,
          receivedAt: new Date().toLocaleTimeString(),
        },
        ...current,
      ].slice(0, 40),
    );
  }

  return {
    conversations,
    setConversations,
    threadId,
    setThreadId,
    input,
    setInput,
    status,
    setStatus,
    events,
    setEvents,
    addEvent,
  };
}
