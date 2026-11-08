import { useState } from "react";
import { StreamLogEntry, createClientId } from "../../lib/langgraphClient";

// Local state is separate from SDK requests and rendering.
export function useSdkConnectionReactHookState() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    "Say hello from the SDK connection React hook example.",
  );
  const [status, setStatus] = useState("Idle");
  const [runId, setRunId] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  function addEvent(event: string, data: unknown, nextRunId?: string) {
    setEvents((current) =>
      [
        {
          id: createClientId("stream"),
          event,
          runId: nextRunId,
          data,
          receivedAt: new Date().toLocaleTimeString(),
        },
        ...current,
      ].slice(0, 80),
    );
    if (nextRunId) setRunId(nextRunId);
  }

  function prepareResetView() {
    setThreadId(null);
    setRunId("");
    setEvents([]);
    setStatus("Idle");
  }

  return {
    prepareResetView,
    threadId,
    setThreadId,
    prompt,
    setPrompt,
    status,
    setStatus,
    runId,
    setRunId,
    events,
    setEvents,
    addEvent,
  };
}
