import { useRef, useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { ProgressEvent, StreamMode } from "./data";

// Local state is separate from SDK requests and rendering.
export function useStreamingReactHookState() {
  const [mode, setMode] = useState<StreamMode>("messages");
  const [prompt, setPrompt] = useState(
    "Explain how LangGraph streaming helps a React UI.",
  );
  const [threadId, setThreadId] = useState<string | null>(null);
  const [status, setStatus] = useState("Idle");
  const [runId, setRunId] = useState("");
  const [updates, setUpdates] = useState<unknown[]>([]);
  const [values, setValues] = useState<unknown[]>([]);
  const [customEvents, setCustomEvents] = useState<ProgressEvent[]>([]);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const valueSnapshotRef = useRef("");
  function prepareRunStream() {
    setRunId("");
    setUpdates([]);
    setValues([]);
    setCustomEvents([]);
    setEvents([]);
  }

  function prepareResetView() {
    setThreadId(null);
    setRunId("");
    setUpdates([]);
    setValues([]);
    setCustomEvents([]);
    setEvents([]);
  }

  return {
    prepareResetView,
    prepareRunStream,
    mode,
    setMode,
    prompt,
    setPrompt,
    threadId,
    setThreadId,
    status,
    setStatus,
    runId,
    setRunId,
    updates,
    setUpdates,
    values,
    setValues,
    customEvents,
    setCustomEvents,
    events,
    setEvents,
    valueSnapshotRef,
  };
}
