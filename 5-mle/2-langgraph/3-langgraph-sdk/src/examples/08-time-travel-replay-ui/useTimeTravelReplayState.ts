import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import {
  defaultReplayInstruction,
  defaultReplayTopic,
  defaultTopic,
  HistoryEntry,
  JsonRecord,
} from "./data";

// Local state is separate from SDK requests and rendering.
export function useTimeTravelReplayState() {
  const [topic, setTopic] = useState(defaultTopic);
  const [replayTopic, setReplayTopic] = useState(defaultReplayTopic);
  const [replayInstruction, setReplayInstruction] = useState(
    defaultReplayInstruction,
  );
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState("");
  const [originalState, setOriginalState] = useState<JsonRecord | null>(null);
  const [replayState, setReplayState] = useState<JsonRecord | null>(null);
  const [replaySourceCheckpointId, setReplaySourceCheckpointId] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setHistory([]);
    setSelectedCheckpointId("");
    setOriginalState(null);
    setReplayState(null);
    setReplaySourceCheckpointId("");
    setEvents([]);
    setError("");
  }

  function prepareRunOriginal() {
    setBusy(true);
    setError("");
    setEvents([]);
    setHistory([]);
    setSelectedCheckpointId("");
    setOriginalState(null);
    setReplayState(null);
    setReplaySourceCheckpointId("");
    setStatus("Creating original thread");
  }

  return {
    prepareRunOriginal,
    topic,
    setTopic,
    replayTopic,
    setReplayTopic,
    replayInstruction,
    setReplayInstruction,
    threadId,
    setThreadId,
    status,
    setStatus,
    history,
    setHistory,
    selectedCheckpointId,
    setSelectedCheckpointId,
    originalState,
    setOriginalState,
    replayState,
    setReplayState,
    replaySourceCheckpointId,
    setReplaySourceCheckpointId,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  };
}
