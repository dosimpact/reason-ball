import { Boxes, CheckCircle2, Code2, Loader2, Play, RotateCcw, Send } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  StreamLogEntry,
  createClientId,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();

const launchPrompt =
  "Create a launch readiness UI card with action buttons and a fallback payload for unsupported UI.";
const supportPrompt =
  "Push an inline support handoff UI message that shows status, summary facts, and review actions.";

type JsonRecord = Record<string, unknown>;

type UIMessage = {
  type: "ui" | "remove-ui";
  id: string;
  name: string;
  props: JsonRecord;
  metadata: JsonRecord;
};

type RenderEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  uiMessageId: string;
  component: string;
};

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
  return typeof value === "number" ? value : Number(value ?? fallback);
}

function normalizeUiMessage(value: unknown): UIMessage | null {
  if (!isRecord(value)) return null;
  if (value.type !== "ui" && value.type !== "remove-ui") return null;
  return {
    type: value.type,
    id: typeof value.id === "string" ? value.id : createClientId("ui"),
    name: typeof value.name === "string" ? value.name : "unknown_component",
    props: isRecord(value.props) ? value.props : {},
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
}

function normalizeUiMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeUiMessage).filter((message): message is UIMessage => message !== null);
}

function mergeUiMessages(current: UIMessage[], next: UIMessage[]) {
  const byId = new Map<string, UIMessage>();
  current.forEach((message) => byId.set(message.id, message));
  next.forEach((message) => {
    if (message.type === "remove-ui") {
      byId.delete(message.id);
      return;
    }
    const previous = byId.get(message.id);
    const merge = message.metadata.merge === true;
    byId.set(message.id, {
      ...message,
      props: merge && previous ? { ...previous.props, ...message.props } : message.props,
    });
  });
  return [...byId.values()].sort((left, right) => {
    const leftOrdinal = numberValue(left.metadata.ordinal, 0);
    const rightOrdinal = numberValue(right.metadata.ordinal, 0);
    return leftOrdinal - rightOrdinal || left.id.localeCompare(right.id);
  });
}

function normalizeRenderEvents(value: unknown): RenderEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "push_ui_message_example",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    uiMessageId: typeof event.ui_message_id === "string" ? event.ui_message_id : "",
    component: typeof event.component === "string" ? event.component : "",
  }));
}

function mergeRenderEvents(current: RenderEvent[], next: RenderEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.uiMessageId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function progressPercent(value: unknown) {
  const progress = numberValue(value, 0);
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
}

function PushUiMessageRenderer({
  message,
  selectedAction,
  onAction,
}: {
  message: UIMessage;
  selectedAction: string;
  onAction: (actionId: string) => void;
}) {
  if (message.name === "task_status_card") {
    const items = Array.isArray(message.props.items) ? message.props.items.filter(isRecord) : [];
    const percent = progressPercent(message.props.progress);
    return (
      <article className="push-ui-card status-card" data-ui-message-id={message.id}>
        <div className="push-ui-card-header">
          <strong>{String(message.props.title ?? "Status card")}</strong>
          <span>{String(message.props.status ?? "unknown")}</span>
        </div>
        <p>{String(message.props.description ?? "")}</p>
        <div className="push-ui-progress" aria-label={`Progress ${percent}%`}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <ul>
          {items.map((item, index) => (
            <li key={`${message.id}-item-${index}`}>
              <CheckCircle2 size={14} />
              <span>{String(item.label ?? "Item")}</span>
              <code>{String(item.status ?? "unknown")}</code>
            </li>
          ))}
        </ul>
      </article>
    );
  }

  if (message.name === "summary_card") {
    const facts = Array.isArray(message.props.facts) ? message.props.facts.filter(isRecord) : [];
    return (
      <article className="push-ui-card summary-card" data-ui-message-id={message.id}>
        <div className="push-ui-card-header">
          <strong>{String(message.props.title ?? "Summary card")}</strong>
          <Boxes size={16} />
        </div>
        <p>{String(message.props.summary ?? "")}</p>
        <div className="summary-fact-grid">
          {facts.map((fact, index) => (
            <div key={`${message.id}-fact-${index}`}>
              <span>{String(fact.label ?? "Fact")}</span>
              <strong>{String(fact.value ?? "")}</strong>
            </div>
          ))}
        </div>
      </article>
    );
  }

  if (message.name === "action_button_group") {
    const actions = Array.isArray(message.props.actions) ? message.props.actions.filter(isRecord) : [];
    return (
      <article className="push-ui-card action-card" data-ui-message-id={message.id}>
        <div className="push-ui-card-header">
          <strong>{String(message.props.title ?? "Actions")}</strong>
          <Send size={16} />
        </div>
        <p>{String(message.props.description ?? "")}</p>
        <div className="push-ui-action-row">
          {actions.map((action) => {
            const actionId = String(action.id ?? action.label ?? "");
            return (
              <button
                key={actionId}
                type="button"
                className={selectedAction === actionId ? "push-ui-action active" : "push-ui-action"}
                onClick={() => onAction(actionId)}
              >
                {String(action.label ?? actionId)}
              </button>
            );
          })}
        </div>
      </article>
    );
  }

  return (
    <article className="push-ui-card fallback-card" data-ui-message-id={message.id}>
      <div className="push-ui-card-header">
        <strong>Unsupported UI message</strong>
        <Code2 size={16} />
      </div>
      <p>Fallback renderer for <code>{message.name}</code></p>
      <pre>{formatJson(message)}</pre>
    </article>
  );
}

export function PushUiMessageExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [prompt, setPrompt] = useState(launchPrompt);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [uiRenderStatus, setUiRenderStatus] = useState("idle");
  const [uiMessages, setUiMessages] = useState<UIMessage[]>([]);
  const [uiMessageIds, setUiMessageIds] = useState<string[]>([]);
  const [uiComponents, setUiComponents] = useState<string[]>([]);
  const [renderEvents, setRenderEvents] = useState<RenderEvent[]>([]);
  const [selectedAction, setSelectedAction] = useState("");
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
  const unsupportedCount = uiMessages.filter((message) => message.name === "legacy_payload").length;

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setUiRenderStatus("idle");
    setUiMessages([]);
    setUiMessageIds([]);
    setUiComponents([]);
    setRenderEvents([]);
    setSelectedAction("");
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (Array.isArray(values.ui)) setUiMessages((current) => mergeUiMessages(current, normalizeUiMessages(values.ui)));
    if (Array.isArray(values.ui_message_ids)) setUiMessageIds(stringList(values.ui_message_ids));
    if (Array.isArray(values.ui_components)) setUiComponents(stringList(values.ui_components));
    if (Array.isArray(values.render_events)) {
      setRenderEvents((current) => mergeRenderEvents(current, normalizeRenderEvents(values.render_events)));
    }
    if (typeof values.answer === "string") setAnswer(values.answer);
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (typeof values.ui_render_status === "string") setUiRenderStatus(values.ui_render_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    const uiMessage = normalizeUiMessage(data);
    if (uiMessage) setUiMessages((current) => mergeUiMessages(current, [uiMessage]));
  }

  async function runPushUiMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setUiMessages([]);
    setUiMessageIds([]);
    setUiComponents([]);
    setRenderEvents([]);
    setSelectedAction("");
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setFinalStatus("running");
    setUiRenderStatus("starting");
    setStatus("Creating push UI thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "25-push-ui-message" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming push UI messages");

      const stream = await client.runs.stream(nextThreadId, "push_ui_message_example", {
        input: { prompt: trimmed },
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
      setUiRenderStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="push-ui-layout">
      <aside className="push-ui-control">
        <div className="panel-title">
          <Boxes aria-hidden="true" size={18} />
          Push UI Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => setPrompt(launchPrompt)} disabled={busy}>
            <Boxes size={16} />
            Use launch sample
          </button>
          <button type="button" className="secondary-button" onClick={() => setPrompt(supportPrompt)} disabled={busy}>
            <Send size={16} />
            Use support sample
          </button>
        </div>
        <form className="run-form" onSubmit={runPushUiMessage}>
          <label className="field">
            <span>UI message prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !prompt.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run push UI message
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
            <span>UI messages</span>
            <strong>{uiMessages.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`push-ui-status-panel ${finalStatus}`} role="region" aria-label="Push UI Status">
        <div className="panel-title">Push UI Status</div>
        <div className="push-ui-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Render Status</span>
            <strong>{uiRenderStatus}</strong>
          </div>
          <div>
            <span>Components</span>
            <strong>{uiComponents.length}</strong>
          </div>
          <div>
            <span>Fallbacks</span>
            <strong>{unsupportedCount}</strong>
          </div>
        </div>
      </div>

      <div className="inline-ui-chat-panel" role="region" aria-label="Inline UI Chat Flow">
        <div className="panel-title">Inline UI Chat Flow</div>
        <div className="push-chat-stack">
          <article className="push-chat-bubble human">
            <strong>User</strong>
            <p>{prompt}</p>
          </article>
          <article className="push-chat-bubble assistant">
            <strong>Assistant UI turn</strong>
            <p>Structured UI messages are attached to this chat turn and rendered below.</p>
            <div className="pushed-ui-message-stack">
              {uiMessages.length === 0 ? (
                <p className="muted">Run the graph to receive UI-only messages from the custom stream.</p>
              ) : (
                uiMessages.map((message) => (
                  <PushUiMessageRenderer
                    key={message.id}
                    message={message}
                    selectedAction={selectedAction}
                    onAction={setSelectedAction}
                  />
                ))
              )}
            </div>
          </article>
        </div>
      </div>

      <div className="ui-message-registry-panel" role="region" aria-label="UI Message Registry">
        <div className="panel-title">UI Message Registry</div>
        <div className="ui-registry-list">
          {uiMessages.length === 0 ? (
            <p className="muted">No UI messages yet.</p>
          ) : (
            uiMessages.map((message) => (
              <article key={`${message.id}-registry`} className="ui-registry-row">
                <strong>{message.name}</strong>
                <code>{message.id}</code>
                <span>{String(message.metadata.schema_version ?? "unknown schema")}</span>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="selected-action-panel" role="region" aria-label="Selected Action">
        <div className="panel-title">Selected Action</div>
        <div className="answer-box compact-answer">
          {selectedAction ? `Selected action: ${selectedAction}` : "No action selected."}
        </div>
      </div>

      <div className="render-events-panel" role="region" aria-label="Render Events">
        <div className="panel-title">Render Events</div>
        <div className="render-event-list">
          {renderEvents.length === 0 ? (
            <p className="muted">Graph render events appear after the run.</p>
          ) : (
            renderEvents.map((event, index) => (
              <article key={`${event.phase}-${event.uiMessageId}-${index}`} className="render-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{event.component || "state"}</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box compact-answer">{final || answer || "No final answer yet."}</div>
      </div>

      <div className="state-panel push-ui-final-state" role="region" aria-label="Final State">
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
