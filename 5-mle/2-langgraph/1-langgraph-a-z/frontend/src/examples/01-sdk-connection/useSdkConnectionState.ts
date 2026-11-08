import { useState } from "react";
import { AssistantRecord, StreamLogEntry } from "../../lib/langgraphClient";

// Local state is separate from SDK requests and rendering.
export function useSdkConnectionState() {
  const [assistants, setAssistants] = useState<AssistantRecord[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] =
    useState("01_sdk_connection");
  const [threadId, setThreadId] = useState("");
  const [prompt, setPrompt] = useState(
    "Say hello from the SDK connection example.",
  );
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [answer, setAnswer] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function prepareRunAssistant() {
    setBusy(true);
    setError("");
    setAnswer("");
    setRunId("");
    setEvents([]);
    setStatus("Starting run");
  }

  return {
    prepareRunAssistant,
    assistants,
    setAssistants,
    selectedAssistantId,
    setSelectedAssistantId,
    threadId,
    setThreadId,
    prompt,
    setPrompt,
    runId,
    setRunId,
    status,
    setStatus,
    answer,
    setAnswer,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
  };
}
