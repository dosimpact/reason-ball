import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { ProgressEvent, StreamMode } from "./data";

// Local state is separate from SDK requests and rendering.
export function useStreamingUiState() {
  const [mode, setMode] = useState<StreamMode>("messages");
  const [prompt, setPrompt] = useState(
    "Explain how LangGraph streaming helps a React UI.",
  );
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [tokenText, setTokenText] = useState("");
  const [updates, setUpdates] = useState<unknown[]>([]);
  const [values, setValues] = useState<unknown[]>([]);
  const [customEvents, setCustomEvents] = useState<ProgressEvent[]>([]);
  const [finalState, setFinalState] = useState<unknown>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    setStatus("Idle");
    setThreadId("");
    setTokenText("");
    setUpdates([]);
    setValues([]);
    setCustomEvents([]);
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function prepareRunStream() {
    setBusy(true);
    setError("");
    setTokenText("");
    setUpdates([]);
    setValues([]);
    setCustomEvents([]);
    setFinalState(null);
    setEvents([]);
  }

  return {
    prepareRunStream,
    mode,
    setMode,
    prompt,
    setPrompt,
    threadId,
    setThreadId,
    status,
    setStatus,
    tokenText,
    setTokenText,
    updates,
    setUpdates,
    values,
    setValues,
    customEvents,
    setCustomEvents,
    finalState,
    setFinalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  };
}
