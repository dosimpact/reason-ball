import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import { type CanvasCheckpoint, type CanvasEdge, type CanvasEvent, type CanvasNode, type CanvasVersion, defaultPrompt, type DiffRow, type ExecutionEvent, type JsonRecord, mergeCanvasEvents, normalizeCanvasEvents, normalizeCheckpoints, normalizeDiff, normalizeEdges, normalizeExecutionEvents, normalizeNodes, normalizeVersions, selectedEventFrom } from "./model";

// Local state, derived values, and synchronous state transitions.
export function useChatGraphExecutionCanvasState() {
  const [userPrompt, setUserPrompt] = useState(defaultPrompt);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [canvasTitle, setCanvasTitle] = useState("Graph Execution Canvas");
  const [chatSummary, setChatSummary] = useState("");
  const [graphNodes, setGraphNodes] = useState<CanvasNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<CanvasEdge[]>([]);
  const [executionEvents, setExecutionEvents] = useState<ExecutionEvent[]>([]);
  const [checkpoints, setCheckpoints] = useState<CanvasCheckpoint[]>([]);
  const [stateDiff, setStateDiff] = useState<DiffRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<ExecutionEvent | null>(null);
  const [activeNode, setActiveNode] = useState("");
  const [replaySummary, setReplaySummary] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [versionHistory, setVersionHistory] = useState<CanvasVersion[]>([]);
  const [canvasEvents, setCanvasEvents] = useState<CanvasEvent[]>([]);
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canInspect = Boolean(threadId) && executionEvents.length > 0 && !busy;
  const activeNodeDetail = graphNodes.find((node) => node.id === activeNode) ?? null;
  const selectedCheckpoint =
    checkpoints.find((checkpoint) => checkpoint.id === selectedEvent?.checkpointId) ??
    checkpoints.find((checkpoint) => checkpoint.eventId === selectedEvent?.id) ??
    checkpoints.find((checkpoint) => checkpoint.nodeId === activeNode) ??
    null;

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setCanvasTitle("Graph Execution Canvas");
    setChatSummary("");
    setGraphNodes([]);
    setGraphEdges([]);
    setExecutionEvents([]);
    setCheckpoints([]);
    setStateDiff([]);
    setSelectedEventId("");
    setSelectedEvent(null);
    setActiveNode("");
    setReplaySummary("");
    setArtifactVersion(0);
    setVersionHistory([]);
    setCanvasEvents([]);
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function chooseEvent(eventId: string, eventsForLookup = executionEvents) {
    setSelectedEventId(eventId);
    const found = eventsForLookup.find((event) => event.id === eventId) ?? null;
    if (found) {
      setSelectedEvent(found);
      setActiveNode(found.nodeId);
    }
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.canvas_title)) setCanvasTitle(values.canvas_title);
    if (R.isString(values.chat_summary)) setChatSummary(values.chat_summary);
    if (R.isArray(values.graph_nodes)) setGraphNodes(normalizeNodes(values.graph_nodes));
    if (R.isArray(values.graph_edges)) setGraphEdges(normalizeEdges(values.graph_edges));
    if (R.isArray(values.execution_events)) {
      const normalized = normalizeExecutionEvents(values.execution_events);
      setExecutionEvents(normalized);
      const nextSelected =
        R.isString(values.selected_event_id)
          ? values.selected_event_id
          : selectedEventId || normalized[0]?.id || "";
      if (nextSelected) chooseEvent(nextSelected, normalized);
    }
    if (R.isArray(values.checkpoints)) setCheckpoints(normalizeCheckpoints(values.checkpoints));
    if (values.state_diff !== undefined) setStateDiff(normalizeDiff(values.state_diff));
    if (R.isString(values.selected_event_id)) setSelectedEventId(values.selected_event_id);
    setSelectedEvent((current) => selectedEventFrom(values, current));
    if (R.isString(values.active_node)) setActiveNode(values.active_node);
    if (R.isString(values.replay_summary)) setReplaySummary(values.replay_summary);
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (R.isArray(values.version_history)) setVersionHistory(normalizeVersions(values.version_history));
    if (R.isArray(values.canvas_events)) {
      setCanvasEvents((current) => mergeCanvasEvents(current, normalizeCanvasEvents(values.canvas_events)));
    }
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status)) setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "32_chat_graph_execution_canvas") return;
    setCanvasEvents((current) => mergeCanvasEvents(current, normalizeCanvasEvents([data])));
  }

  function startRun(reuseThreadId: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming canvas update" : "Creating debugger thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setFinalStatus("failed");
    setStatus("Run failed");
  }

  return {
    userPrompt,
    setUserPrompt,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    setFinalStatus,
    canvasTitle,
    chatSummary,
    graphNodes,
    graphEdges,
    executionEvents,
    checkpoints,
    stateDiff,
    selectedEventId,
    selectedEvent,
    activeNode,
    setActiveNode,
    replaySummary,
    artifactVersion,
    versionHistory,
    canvasEvents,
    final,
    finalState,
    events,
    setEvents,
    error,
    busy,
    setBusy,
    canInspect,
    activeNodeDetail,
    selectedCheckpoint,
    resetView,
    chooseEvent,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  };
}
