import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { TimelineNode, initialNodes } from "./data";

// Local state is separate from SDK requests and rendering.
export function useGraphExecutionTimelineState() {
  const [topic, setTopic] = useState("streaming graph updates");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [nodes, setNodes] = useState<TimelineNode[]>(initialNodes);
  const [finalState, setFinalState] = useState<unknown>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    setNodes(initialNodes());
    setFinalState(null);
    setEvents([]);
    setError("");
    setStatus("Idle");
    setThreadId("");
  }

  function prepareRunTimeline() {
    setBusy(true);
    setError("");
    setFinalState(null);
    setEvents([]);
  }

  return {
    prepareRunTimeline,
    topic,
    setTopic,
    threadId,
    setThreadId,
    status,
    setStatus,
    nodes,
    setNodes,
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
