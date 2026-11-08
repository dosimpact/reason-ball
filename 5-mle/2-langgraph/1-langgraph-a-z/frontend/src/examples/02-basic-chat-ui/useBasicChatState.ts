import { useState } from "react";
import { ChatMessageRecord, StreamLogEntry } from "../../lib/langgraphClient";
import { Conversation } from "./data";

// Local state is separate from SDK requests and rendering.
export function useBasicChatState() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [input, setInput] = useState("My project code is cobalt.");
  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function prepareSendMessage() {
    setBusy(true);
    setError("");
    setInput("");
    setStatus("Sending message");
    setEvents([]);
  }

  return {
    prepareSendMessage,
    conversations,
    setConversations,
    threadId,
    setThreadId,
    messages,
    setMessages,
    input,
    setInput,
    status,
    setStatus,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
  };
}
