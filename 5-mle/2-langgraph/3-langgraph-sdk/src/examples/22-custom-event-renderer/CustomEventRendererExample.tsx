import { AlertTriangle, CheckCircle2, Loader2, Play, RotateCcw, RadioTower } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  StreamLogEntry,
  createClientId,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();

const warningPrompt =
  "Render inline progress for a legacy import with warning events and preserve unknown diagnostic payloads.";
const cleanPrompt =
  "Render inline progress for a clean analytics export with phase, progress, and status updates.";

type JsonRecord = Record<string, unknown>;

type RendererEvent = {
  type: string;
  schemaVersion: string;
  kind: string;
  eventId: string;
  replaceKey: string;
  sequence: number;
  phase: string;
  node: string;
  status: string;
  progress: number;
  message: string;
  severity: string;
  timestamp: string;
};

type PhaseRecord = {
  phase: string;
  label: string;
  status: string;
  progress: number;
  lastMessage: string;
};

const knownKinds = new Set(["phase", "progress", "status", "warning"]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function normalizeRendererEvent(value: unknown): RendererEvent | null {
  if (!isRecord(value)) return null;
  if (value.type !== "custom_event_renderer" && typeof value.kind !== "string") return null;
  return {
    type: typeof value.type === "string" ? value.type : "custom_event_renderer",
    schemaVersion: typeof value.schema_version === "string" ? value.schema_version : "unknown",
    kind: typeof value.kind === "string" ? value.kind : "unknown",
    eventId: typeof value.event_id === "string" ? value.event_id : createClientId("event"),
    replaceKey: typeof value.replace_key === "string" ? value.replace_key : "",
    sequence: numberValue(value.sequence),
    phase: typeof value.phase === "string" ? value.phase : "unknown",
    node: typeof value.node === "string" ? value.node : "unknown",
    status: typeof value.status === "string" ? value.status : "",
    progress: numberValue(value.progress),
    message: typeof value.message === "string" ? value.message : "",
    severity: typeof value.severity === "string" ? value.severity : "info",
    timestamp: typeof value.timestamp === "string" ? value.timestamp : "",
  };
}

function normalizeRendererEvents(value: unknown): RendererEvent[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeRendererEvent).filter((event): event is RendererEvent => event !== null);
}

function normalizePhaseRecords(value: unknown): PhaseRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((record) => ({
    phase: typeof record.phase === "string" ? record.phase : "",
    label: typeof record.label === "string" ? record.label : "",
    status: typeof record.status === "string" ? record.status : "",
    progress: numberValue(record.progress),
    lastMessage: typeof record.last_message === "string" ? record.last_message : "",
  }));
}

function mergeUniqueByEventId(current: RendererEvent[], next: RendererEvent[]) {
  const byId = new Map<string, RendererEvent>();
  [...current, ...next].forEach((event) => byId.set(event.eventId, event));
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence).slice(-120);
}

function inlineKey(event: RendererEvent) {
  if (event.kind === "warning") return event.eventId;
  return event.replaceKey || event.eventId;
}

function mergeInlineEvents(current: RendererEvent[], next: RendererEvent[]) {
  const byKey = new Map<string, RendererEvent>();
  [...current, ...next]
    .filter((event) => knownKinds.has(event.kind))
    .forEach((event) => byKey.set(inlineKey(event), event));
  return [...byKey.values()].sort((left, right) => left.sequence - right.sequence);
}

function mergePhaseRecords(current: PhaseRecord[], next: PhaseRecord[]) {
  const byPhase = new Map<string, PhaseRecord>();
  [...current, ...next].forEach((record) => {
    if (record.phase) byPhase.set(record.phase, record);
  });
  return [...byPhase.values()];
}

function eventPercent(event: RendererEvent) {
  return Math.max(0, Math.min(100, Math.round(event.progress * 100)));
}

function phasePercent(record: PhaseRecord) {
  return Math.max(0, Math.min(100, Math.round(record.progress * 100)));
}

export function CustomEventRendererExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [taskId, setTaskId] = useState("renderer-demo-001");
  const [taskPrompt, setTaskPrompt] = useState(warningPrompt);
  const [threadId, setThreadId] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [inlineEvents, setInlineEvents] = useState<RendererEvent[]>([]);
  const [renderEvents, setRenderEvents] = useState<RendererEvent[]>([]);
  const [phaseRecords, setPhaseRecords] = useState<PhaseRecord[]>([]);
  const [unknownEvents, setUnknownEvents] = useState<RendererEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rendererMetadata, setRendererMetadata] = useState<JsonRecord | null>(null);
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
  const warningEvents = renderEvents.filter((event) => event.kind === "warning");
  const progressComplete = inlineEvents.some((event) => event.progress >= 1 || event.status === "completed");

  function resetView() {
    setThreadId("");
    setRunId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setInlineEvents([]);
    setRenderEvents([]);
    setPhaseRecords([]);
    setUnknownEvents([]);
    setWarnings([]);
    setRendererMetadata(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyRendererEvents(next: RendererEvent[]) {
    setRenderEvents((current) => mergeUniqueByEventId(current, next));
    setInlineEvents((current) => mergeInlineEvents(current, next));
    const unknown = next.filter((event) => !knownKinds.has(event.kind));
    if (unknown.length) setUnknownEvents((current) => mergeUniqueByEventId(current, unknown));
  }

  function applyValues(values: JsonRecord) {
    if (typeof values.run_id === "string") setRunId(values.run_id);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Array.isArray(values.render_events)) applyRendererEvents(normalizeRendererEvents(values.render_events));
    if (Array.isArray(values.progress_events)) applyRendererEvents(normalizeRendererEvents(values.progress_events));
    if (Array.isArray(values.unknown_events)) {
      setUnknownEvents((current) => mergeUniqueByEventId(current, normalizeRendererEvents(values.unknown_events)));
    }
    if (Array.isArray(values.phase_records)) {
      setPhaseRecords((current) => mergePhaseRecords(current, normalizePhaseRecords(values.phase_records)));
    }
    if (Array.isArray(values.warnings)) setWarnings(values.warnings.map(String));
    if (isRecord(values.renderer_metadata)) setRendererMetadata(values.renderer_metadata);
    if (typeof values.answer === "string") setAnswer(values.answer);
    if (typeof values.final === "string") setFinal(values.final);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    const event = normalizeRendererEvent(data);
    if (!event) return;
    applyRendererEvents([event]);
  }

  async function runRenderer(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmedTask = taskPrompt.trim();
    const trimmedId = taskId.trim();
    if (!trimmedTask || !trimmedId) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setInlineEvents([]);
    setRenderEvents([]);
    setPhaseRecords([]);
    setUnknownEvents([]);
    setWarnings([]);
    setRendererMetadata(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setFinalStatus("running");
    setStatus("Creating renderer thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "22-custom-event-renderer" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming custom events");
      const stream = await client.runs.stream(nextThreadId, "custom_event_renderer", {
        input: {
          task_id: trimmedId,
          task_prompt: trimmedTask,
        },
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 160));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
      setFinalStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="custom-event-layout">
      <aside className="custom-event-control">
        <div className="panel-title">
          <RadioTower aria-hidden="true" size={18} />
          Custom Event Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => setTaskPrompt(warningPrompt)} disabled={busy}>
            <AlertTriangle size={16} />
            Use warning sample
          </button>
          <button type="button" className="secondary-button" onClick={() => setTaskPrompt(cleanPrompt)} disabled={busy}>
            <CheckCircle2 size={16} />
            Use clean sample
          </button>
        </div>
        <form className="run-form" onSubmit={runRenderer}>
          <label className="field">
            <span>Task ID</span>
            <input value={taskId} onChange={(event) => setTaskId(event.target.value)} />
          </label>
          <label className="field">
            <span>Task prompt</span>
            <textarea value={taskPrompt} onChange={(event) => setTaskPrompt(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !taskId.trim() || !taskPrompt.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run renderer
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
            <span>Run ID</span>
            <strong>{runId || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`renderer-status-panel ${finalStatus}`} role="region" aria-label="Renderer Status">
        <div className="panel-title">Renderer Status</div>
        <div className="renderer-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Inline Events</span>
            <strong>{inlineEvents.length}</strong>
          </div>
          <div>
            <span>Warnings</span>
            <strong>{warningEvents.length + warnings.length}</strong>
          </div>
          <div>
            <span>Progress</span>
            <strong>{progressComplete ? "100%" : `${Math.max(0, ...inlineEvents.map(eventPercent))}%`}</strong>
          </div>
        </div>
      </div>

      <div className="inline-renderer-panel" role="region" aria-label="Inline Event Renderer">
        <div className="panel-title">Inline Event Renderer</div>
        <div className="renderer-chat-flow">
          <article className="renderer-message human">
            <strong>Human task</strong>
            <p>{taskPrompt || "No task prompt yet."}</p>
            <small>{taskId || "no task id"}</small>
          </article>
          {inlineEvents.length === 0 ? (
            <p className="muted">Run the graph to render custom events inline.</p>
          ) : (
            inlineEvents.map((event) => (
              <article key={inlineKey(event)} className={`renderer-event-card ${event.kind} ${event.status}`}>
                <div className="renderer-event-header">
                  <div>
                    <strong>{event.kind} event</strong>
                    <span>{event.phase} / {event.node}</span>
                  </div>
                  <code>{event.status || event.severity}</code>
                </div>
                <p>{event.message}</p>
                <div className="renderer-progress-row">
                  <meter min={0} max={100} value={eventPercent(event)} />
                  <span>{eventPercent(event)}%</span>
                </div>
              </article>
            ))
          )}
          <article className="renderer-message assistant">
            <strong>Assistant answer</strong>
            <p>{final || answer || "Final assistant message appears after the event renderer completes."}</p>
          </article>
        </div>
      </div>

      <div className="phase-progress-panel" role="region" aria-label="Phase Progress">
        <div className="panel-title">Phase Progress</div>
        <div className="phase-progress-list">
          {phaseRecords.length === 0 ? (
            <p className="muted">Phase progress appears after the run starts.</p>
          ) : (
            phaseRecords.map((record) => (
              <article key={record.phase} className={`phase-progress-card ${record.status}`}>
                <strong>{record.label || record.phase}</strong>
                <code>{record.status}</code>
                <p>{record.lastMessage}</p>
                <div>
                  <meter min={0} max={100} value={phasePercent(record)} />
                  <span>{phasePercent(record)}%</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="warning-events-panel" role="region" aria-label="Warning Events">
        <div className="panel-title">Warning Events</div>
        {warningEvents.length === 0 && warnings.length === 0 ? (
          <p className="muted">Warning renderer rows appear when custom warning events arrive.</p>
        ) : (
          <div className="warning-event-list">
            {[...warningEvents.map((event) => event.message), ...warnings].map((warning, index) => (
              <article key={`${warning}-${index}`} className="warning-event-card">
                <AlertTriangle aria-hidden="true" size={16} />
                <span>{warning}</span>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="unknown-event-panel" role="region" aria-label="Unknown Event Inspector">
        <div className="panel-title">Unknown Event Inspector</div>
        {unknownEvents.length === 0 ? (
          <p className="muted">Unknown custom events are preserved here instead of breaking the renderer.</p>
        ) : (
          <div className="unknown-event-list">
            {unknownEvents.map((event) => (
              <details key={event.eventId} className="unknown-event-row" open>
                <summary>
                  <strong>{event.kind}</strong>
                  <span>{event.status}</span>
                </summary>
                <pre>{formatJson(event)}</pre>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box compact-answer">{final || answer || "No final answer yet."}</div>
      </div>

      <div className="state-panel custom-event-final-state" role="region" aria-label="Final State">
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

      {rendererMetadata ? <span className="visually-hidden">{formatJson(rendererMetadata)}</span> : null}
    </section>
  );
}
