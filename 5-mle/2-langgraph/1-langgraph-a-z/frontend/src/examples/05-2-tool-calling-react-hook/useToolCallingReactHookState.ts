import { useState } from "react";
import { StreamLogEntry, createClientId } from "../../lib/langgraphClient";
import { samplePrompts } from "./data";

// Local state is separate from SDK requests and rendering.
export function useToolCallingReactHookState() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(samplePrompts[0]);
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
      ].slice(0, 80),
    );
  }

  return {
    threadId,
    setThreadId,
    prompt,
    setPrompt,
    status,
    setStatus,
    events,
    setEvents,
    addEvent,
  };
}
