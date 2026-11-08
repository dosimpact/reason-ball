import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { defaultTopic, HistoryEntry, JsonRecord } from "./data";

// Local state is separate from SDK requests and rendering.
export function useCheckpointStateHistoryState() {
  const [topic, setTopic] = useState(defaultTopic);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [currentState, setCurrentState] = useState<JsonRecord | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setCurrentState(null);
    setHistory([]);
    setSelectedCheckpointId("");
    setEvents([]);
    setError("");
  }

  function prepareRunCheckpointHistory() {
    setBusy(true);
    setError("");
    setEvents([]);
    setCurrentState(null);
    setHistory([]);
    setSelectedCheckpointId("");
    setStatus("Creating thread");
  }

  return {
    prepareRunCheckpointHistory,
    topic,
    setTopic,
    threadId,
    setThreadId,
    status,
    setStatus,
    currentState,
    setCurrentState,
    history,
    setHistory,
    selectedCheckpointId,
    setSelectedCheckpointId,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  };
}
