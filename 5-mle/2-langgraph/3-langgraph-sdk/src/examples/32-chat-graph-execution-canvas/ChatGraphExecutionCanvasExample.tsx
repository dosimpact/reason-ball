import { GitBranch, Loader2, MousePointer2, Play, RotateCcw, StepBack } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultPrompt =
  "Explain a LangGraph SDK run with chat, subgraph execution, checkpoints, and replay inspection.";

type JsonRecord = Record<string, unknown>;

type CanvasNode = {
  id: string;
  label: string;
  status: string;
  detail: string;
  lane: string;
};

type CanvasEdge = {
  from: string;
  to: string;
  label: string;
};

type ExecutionEvent = {
  id: string;
  nodeId: string;
  phase: string;
  status: string;
  detail: string;
  checkpointId: string;
};

type CanvasCheckpoint = {
  id: string;
  label: string;
  eventId: string;
  nodeId: string;
  summary: string;
};

type DiffRow = {
  key: string;
  before: string;
  after: string;
  status: string;
};

type CanvasVersion = {
  version: number;
  summary: string;
  selectedEventId: string;
};

type CanvasEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function normalizeNodes(value: unknown): CanvasNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((node) => ({
    id: typeof node.id === "string" ? node.id : "",
    label: typeof node.label === "string" ? node.label : "",
    status: typeof node.status === "string" ? node.status : "pending",
    detail: typeof node.detail === "string" ? node.detail : "",
    lane: typeof node.lane === "string" ? node.lane : typeof node.kind === "string" ? node.kind : "main",
  }));
}

function normalizeEdges(value: unknown): CanvasEdge[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((edge) => ({
    from: typeof edge.from === "string" ? edge.from : typeof edge.source === "string" ? edge.source : "",
    to: typeof edge.to === "string" ? edge.to : typeof edge.target === "string" ? edge.target : "",
    label: typeof edge.label === "string" ? edge.label : "",
  }));
}

function normalizeExecutionEvents(value: unknown): ExecutionEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    id: typeof event.id === "string" ? event.id : "",
    nodeId: typeof event.node_id === "string" ? event.node_id : "",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    checkpointId: typeof event.checkpoint_id === "string" ? event.checkpoint_id : "",
  }));
}

function normalizeCheckpoints(value: unknown): CanvasCheckpoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((checkpoint) => ({
    id: typeof checkpoint.id === "string" ? checkpoint.id : "",
    label: typeof checkpoint.label === "string" ? checkpoint.label : "",
    eventId: typeof checkpoint.event_id === "string" ? checkpoint.event_id : "",
    nodeId: typeof checkpoint.node_id === "string" ? checkpoint.node_id : "",
    summary: typeof checkpoint.summary === "string" ? checkpoint.summary : "",
  }));
}

function normalizeDiff(value: unknown): DiffRow[] {
  if (isRecord(value)) {
    const rows: DiffRow[] = [];
    const added = isRecord(value.added) ? value.added : {};
    const changed = isRecord(value.changed) ? value.changed : {};
    const removed = Array.isArray(value.removed) ? value.removed.map(String) : [];
    for (const [key, after] of Object.entries(added)) {
      rows.push({ key, before: "undefined", after: formatJson(after), status: "added" });
    }
    for (const [key, after] of Object.entries(changed)) {
      rows.push({ key, before: "previous", after: formatJson(after), status: "changed" });
    }
    for (const key of removed) {
      rows.push({ key, before: "present", after: "removed", status: "removed" });
    }
    if (typeof value.event_id === "string") {
      rows.unshift({ key: "event_id", before: "previous", after: value.event_id, status: "selected" });
    }
    return rows;
  }
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((row) => ({
    key: typeof row.key === "string" ? row.key : "",
    before: typeof row.before === "string" ? row.before : "",
    after: typeof row.after === "string" ? row.after : "",
    status: typeof row.status === "string" ? row.status : "changed",
  }));
}

function normalizeVersions(value: unknown): CanvasVersion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((version) => ({
    version: numberValue(version.version),
    summary: typeof version.summary === "string" ? version.summary : "",
    selectedEventId: typeof version.selected_event_id === "string" ? version.selected_event_id : "",
  }));
}

function normalizeCanvasEvents(value: unknown): CanvasEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "chat_graph_execution_canvas",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    progress: numberValue(event.progress),
  }));
}

function mergeCanvasEvents(current: CanvasEvent[], next: CanvasEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.progress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectedEventFrom(values: JsonRecord, fallback: ExecutionEvent | null): ExecutionEvent | null {
  if (!isRecord(values.selected_event)) return fallback;
  return normalizeExecutionEvents([values.selected_event])[0] ?? fallback;
}

export function ChatGraphExecutionCanvasExample() {
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

  const client = useMemo(() => createLangGraphClient(), []);
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
    if (typeof values.canvas_title === "string") setCanvasTitle(values.canvas_title);
    if (typeof values.chat_summary === "string") setChatSummary(values.chat_summary);
    if (Array.isArray(values.graph_nodes)) setGraphNodes(normalizeNodes(values.graph_nodes));
    if (Array.isArray(values.graph_edges)) setGraphEdges(normalizeEdges(values.graph_edges));
    if (Array.isArray(values.execution_events)) {
      const normalized = normalizeExecutionEvents(values.execution_events);
      setExecutionEvents(normalized);
      const nextSelected =
        typeof values.selected_event_id === "string"
          ? values.selected_event_id
          : selectedEventId || normalized[0]?.id || "";
      if (nextSelected) chooseEvent(nextSelected, normalized);
    }
    if (Array.isArray(values.checkpoints)) setCheckpoints(normalizeCheckpoints(values.checkpoints));
    if (values.state_diff !== undefined) setStateDiff(normalizeDiff(values.state_diff));
    if (typeof values.selected_event_id === "string") setSelectedEventId(values.selected_event_id);
    setSelectedEvent((current) => selectedEventFrom(values, current));
    if (typeof values.active_node === "string") setActiveNode(values.active_node);
    if (typeof values.replay_summary === "string") setReplaySummary(values.replay_summary);
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (Array.isArray(values.version_history)) setVersionHistory(normalizeVersions(values.version_history));
    if (Array.isArray(values.canvas_events)) {
      setCanvasEvents((current) => mergeCanvasEvents(current, normalizeCanvasEvents(values.canvas_events)));
    }
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "chat_graph_execution_canvas") return;
    setCanvasEvents((current) => mergeCanvasEvents(current, normalizeCanvasEvents([data])));
  }

  async function streamRun(input: JsonRecord, reuseThreadId = "") {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming canvas update" : "Creating debugger thread");

    try {
      const nextThreadId =
        reuseThreadId ||
        String(
          (
            await client.threads.create({
              metadata: { example: "32-chat-graph-execution-canvas" },
            })
          ).thread_id,
        );
      setThreadId(nextThreadId);
      setStatus("Streaming graph canvas");

      const stream = await client.runs.stream(nextThreadId, "32_chat_graph_execution_canvas", {
        input,
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 180));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setFinalStatus("failed");
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function runInspect(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const prompt = userPrompt.trim();
    if (!prompt) return;
    resetView();
    setFinalStatus("running");
    await streamRun({ user_prompt: prompt, action: "inspect" });
  }

  async function inspectSelectedEvent() {
    if (!threadId || !selectedEventId) return;
    await streamRun({ action: "select_event", selected_event_id: selectedEventId }, threadId);
  }

  async function runTimeTravel() {
    if (!threadId || !selectedEventId) return;
    await streamRun({ action: "time_travel", selected_event_id: selectedEventId }, threadId);
  }

  return (
    <section className="graph-canvas-layout">
      <aside className="graph-canvas-control">
        <div className="panel-title">
          <GitBranch aria-hidden="true" size={18} />
          Graph Canvas Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form className="run-form" onSubmit={runInspect}>
          <label className="field">
            <span>Debugger prompt</span>
            <textarea value={userPrompt} onChange={(event) => setUserPrompt(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !userPrompt.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run graph canvas
            </button>
            <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>
        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span>Thread ID</span>
            <strong>{threadId || "none"}</strong>
          </div>
          <div>
            <span>Version</span>
            <strong>v{artifactVersion}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`graph-canvas-status-panel ${finalStatus}`} role="region" aria-label="Debugger Status">
        <div className="panel-title">Debugger Status</div>
        <div className="graph-canvas-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Active Node</span>
            <strong>{activeNode || "none"}</strong>
          </div>
          <div>
            <span>Events</span>
            <strong>{executionEvents.length}</strong>
          </div>
          <div>
            <span>Checkpoints</span>
            <strong>{checkpoints.length}</strong>
          </div>
        </div>
      </div>

      <div className="graph-canvas-chat-panel" role="region" aria-label="Chat Transcript">
        <div className="panel-title">Chat Transcript</div>
        <article className="graph-canvas-chat-message user">
          <strong>User</strong>
          <p>{userPrompt}</p>
        </article>
        <article className="graph-canvas-chat-message assistant">
          <strong>Assistant</strong>
          <p>{chatSummary || final || "No graph canvas yet."}</p>
        </article>
      </div>

      <div className="graph-canvas-panel" role="region" aria-label="Graph Execution Canvas">
        <div className="panel-title">{canvasTitle}</div>
        <div className="graph-canvas-node-grid">
          {graphNodes.length === 0 ? (
            <p className="muted">Run the graph to render debugger nodes.</p>
          ) : (
            graphNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={node.id === activeNode ? `graph-node-card ${node.status} active` : `graph-node-card ${node.status}`}
                onClick={() => setActiveNode(node.id)}
              >
                <span>{node.lane}</span>
                <strong>{node.label}</strong>
                <p>{node.detail}</p>
                <code>{node.id}</code>
              </button>
            ))
          )}
        </div>
        <div className="graph-edge-list">
          {graphEdges.map((edge) => (
            <article key={`${edge.from}-${edge.to}`} className="graph-edge-row">
              <code>{edge.from}</code>
              <span>{edge.label}</span>
              <code>{edge.to}</code>
            </article>
          ))}
        </div>
      </div>

      <div className="graph-event-inspector-panel" role="region" aria-label="Event Inspector">
        <div className="panel-title">Event Inspector</div>
        <div className="graph-event-list">
          {executionEvents.length === 0 ? (
            <p className="muted">No execution events yet.</p>
          ) : (
            executionEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className={event.id === selectedEventId ? "graph-event-row active" : "graph-event-row"}
                onClick={() => chooseEvent(event.id)}
              >
                <strong>{event.id}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{event.nodeId}</code>
              </button>
            ))
          )}
        </div>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={inspectSelectedEvent} disabled={!canInspect || !selectedEventId}>
            <MousePointer2 size={16} />
            Inspect selected event
          </button>
          <button type="button" className="secondary-button" onClick={runTimeTravel} disabled={!canInspect || !selectedEventId}>
            <StepBack size={16} />
            Time travel replay
          </button>
        </div>
      </div>

      <div className="checkpoint-canvas-panel" role="region" aria-label="Checkpoint Timeline">
        <div className="panel-title">Checkpoint Timeline</div>
        <div className="checkpoint-canvas-list">
          {checkpoints.length === 0 ? (
            <p className="muted">No checkpoints yet.</p>
          ) : (
            checkpoints.map((checkpoint) => (
              <article key={checkpoint.id} className={checkpoint.id === selectedCheckpoint?.id ? "checkpoint-canvas-row active" : "checkpoint-canvas-row"}>
                <strong>{checkpoint.label}</strong>
                <code>{checkpoint.id}</code>
                <p>{checkpoint.summary}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-diff-panel" role="region" aria-label="State Diff">
        <div className="panel-title">State Diff</div>
        <div className="state-diff-list">
          {stateDiff.length === 0 ? (
            <p className="muted">No state diff yet.</p>
          ) : (
            stateDiff.map((row) => (
              <article key={row.key} className={`state-diff-row ${row.status}`}>
                <strong>{row.key}</strong>
                <span>{row.status}</span>
                <p>{row.before}</p>
                <p>{row.after}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="replay-summary-panel" role="region" aria-label="Time Travel Replay">
        <div className="panel-title">Time Travel Replay</div>
        <article className="replay-summary-card">
          <strong>{selectedEvent?.id || "No event selected"}</strong>
          <p>{replaySummary || final || "Select an event, then run a replay."}</p>
          <code>{selectedCheckpoint?.id || "no-checkpoint"}</code>
        </article>
        {activeNodeDetail ? (
          <article className="replay-summary-card">
            <strong>{activeNodeDetail.label}</strong>
            <p>{activeNodeDetail.detail}</p>
            <code>{activeNodeDetail.status}</code>
          </article>
        ) : null}
      </div>

      <div className="graph-version-panel" role="region" aria-label="Version History">
        <div className="panel-title">Version History</div>
        <div className="graph-version-list">
          {versionHistory.length === 0 ? (
            <p className="muted">No canvas versions yet.</p>
          ) : (
            versionHistory.map((version) => (
              <article key={version.version} className="graph-version-row">
                <strong>v{version.version}</strong>
                <p>{version.summary}</p>
                <code>{version.selectedEventId || "no-event"}</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="graph-canvas-events-panel" role="region" aria-label="Canvas Events">
        <div className="panel-title">Canvas Events</div>
        <div className="graph-canvas-event-list">
          {canvasEvents.length === 0 ? (
            <p className="muted">No canvas events yet.</p>
          ) : (
            canvasEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className="graph-canvas-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{percent(event.progress)}%</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel graph-canvas-final-state" role="region" aria-label="Final State">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
      </div>

      <div className="event-panel" role="region" aria-label="Raw Stream Events">
        <div className="panel-title">Raw Stream Events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            events.map((entry) => (
              <details key={entry.id} className="event-row">
                <summary>
                  <span>{entry.receivedAt}</span>
                  <strong>event {entry.event}</strong>
                </summary>
                <pre>{formatJson(entry.data)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
