import {
  Archive,
  Clock3,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  RotateCcw,
  Scissors,
  Send,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  ChatMessageRecord,
  StreamLogEntry,
  createLangGraphClient,
  normalizeMessages,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();

const seedMessages = [
  "My name is Dogyung.",
  "Project codename is cobalt.",
  "My pet is a cat named Moka.",
  "I work from Seoul.",
  "I prefer concise examples.",
  "I need stream events separated from message history.",
  "Keep checkpoint IDs visible in the UI.",
  "I am testing long context compaction.",
  "Screenshots must show summary and recent messages.",
  "Now answer with one sentence that you are ready to compact older context.",
];

type JsonRecord = Record<string, unknown>;

type MessageDigest = {
  id: string;
  role: string;
  content: string;
  index: number;
};

type SummaryMetadata = {
  compactionId: string;
  createdAt: string;
  sourceMessageRange: string;
  sourceCount: number;
  retainedCount: number;
  retainedMessageIds: string[];
  removedMessageIds: string[];
  summaryChars: number;
};

type SummaryRecord = {
  compactionId: string;
  createdAt: string;
  sourceMessageRange: string;
  sourceCount: number;
  retainedCount: number;
  summary: string;
  removedMessages: MessageDigest[];
  retainedMessageIds: string[];
};

type ContextStats = {
  summarizeAfter: number;
  keepRecent: number;
  totalMessages: number;
  retainedMessageCount: number;
  summarizedMessageCount: number;
  summaryRecordCount: number;
  compactionTriggered: boolean;
};

type ContextEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  compactionId: string;
  messageCount: number;
  retainedCount: number;
  removedCount: number;
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

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeDigest(value: unknown, fallbackIndex = 0): MessageDigest {
  const record = isRecord(value) ? value : {};
  return {
    id: typeof record.id === "string" ? record.id : `message-${fallbackIndex + 1}`,
    role: typeof record.role === "string" ? record.role : "unknown",
    content: typeof record.content === "string" ? record.content : "",
    index: typeof record.index === "number" ? record.index : fallbackIndex + 1,
  };
}

function normalizeDigests(value: unknown): MessageDigest[] {
  return Array.isArray(value) ? value.map((item, index) => normalizeDigest(item, index)) : [];
}

function normalizeMetadata(value: unknown): SummaryMetadata | null {
  if (!isRecord(value)) return null;
  return {
    compactionId: typeof value.compaction_id === "string" ? value.compaction_id : "",
    createdAt: typeof value.created_at === "string" ? value.created_at : "",
    sourceMessageRange:
      typeof value.source_message_range === "string" ? value.source_message_range : "",
    sourceCount: typeof value.source_count === "number" ? value.source_count : 0,
    retainedCount: typeof value.retained_count === "number" ? value.retained_count : 0,
    retainedMessageIds: stringList(value.retained_message_ids),
    removedMessageIds: stringList(value.removed_message_ids),
    summaryChars: typeof value.summary_chars === "number" ? value.summary_chars : 0,
  };
}

function normalizeSummaryRecords(value: unknown): SummaryRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((record) => ({
    compactionId: typeof record.compaction_id === "string" ? record.compaction_id : "",
    createdAt: typeof record.created_at === "string" ? record.created_at : "",
    sourceMessageRange:
      typeof record.source_message_range === "string" ? record.source_message_range : "",
    sourceCount: typeof record.source_count === "number" ? record.source_count : 0,
    retainedCount: typeof record.retained_count === "number" ? record.retained_count : 0,
    summary: typeof record.summary === "string" ? record.summary : "",
    removedMessages: normalizeDigests(record.removed_messages),
    retainedMessageIds: stringList(record.retained_message_ids),
  }));
}

function normalizeContextStats(value: unknown): ContextStats {
  const record = isRecord(value) ? value : {};
  return {
    summarizeAfter: typeof record.summarize_after === "number" ? record.summarize_after : 8,
    keepRecent: typeof record.keep_recent === "number" ? record.keep_recent : 4,
    totalMessages: typeof record.total_messages === "number" ? record.total_messages : 0,
    retainedMessageCount:
      typeof record.retained_message_count === "number" ? record.retained_message_count : 0,
    summarizedMessageCount:
      typeof record.summarized_message_count === "number" ? record.summarized_message_count : 0,
    summaryRecordCount:
      typeof record.summary_record_count === "number" ? record.summary_record_count : 0,
    compactionTriggered:
      typeof record.compaction_triggered === "boolean" ? record.compaction_triggered : false,
  };
}

function normalizeContextEvents(value: unknown): ContextEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "context_status",
    phase: typeof event.phase === "string" ? event.phase : "event",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    compactionId:
      typeof event.compaction_id === "string" ? event.compaction_id : String(event.compactionId ?? ""),
    messageCount: typeof event.message_count === "number" ? event.message_count : 0,
    retainedCount: typeof event.retained_count === "number" ? event.retained_count : 0,
    removedCount: typeof event.removed_count === "number" ? event.removed_count : 0,
  }));
}

function mergeEvents(current: ContextEvent[], next: ContextEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next]
    .filter((event) => {
      const key = `${event.phase}:${event.status}:${event.compactionId}:${event.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-80);
}

export function LongContextExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [summary, setSummary] = useState("");
  const [summaryMetadata, setSummaryMetadata] = useState<SummaryMetadata | null>(null);
  const [summaryRecords, setSummaryRecords] = useState<SummaryRecord[]>([]);
  const [summarizedMessages, setSummarizedMessages] = useState<MessageDigest[]>([]);
  const [contextEvents, setContextEvents] = useState<ContextEvent[]>([]);
  const [contextStats, setContextStats] = useState<ContextStats>(normalizeContextStats(null));
  const [assistantResponse, setAssistantResponse] = useState("");
  const [final, setFinal] = useState("");
  const [lastCompactionRunId, setLastCompactionRunId] = useState("");
  const [followUp, setFollowUp] = useState(
    "Using the summarized earlier context, what project codename and pet name did I mention?",
  );
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);

  function resetState() {
    setThreadId("");
    setStatus("Idle");
    setMessages([]);
    setSummary("");
    setSummaryMetadata(null);
    setSummaryRecords([]);
    setSummarizedMessages([]);
    setContextEvents([]);
    setContextStats(normalizeContextStats(null));
    setAssistantResponse("");
    setFinal("");
    setLastCompactionRunId("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (Array.isArray(values.messages)) setMessages(normalizeMessages(values));
    if (typeof values.summary === "string") setSummary(values.summary);
    if (isRecord(values.summary_metadata)) setSummaryMetadata(normalizeMetadata(values.summary_metadata));
    if (Array.isArray(values.summary_records)) setSummaryRecords(normalizeSummaryRecords(values.summary_records));
    if (Array.isArray(values.summarized_messages)) setSummarizedMessages(normalizeDigests(values.summarized_messages));
    if (Array.isArray(values.context_events)) {
      setContextEvents((current) => mergeEvents(current, normalizeContextEvents(values.context_events)));
    }
    if (isRecord(values.context_stats)) setContextStats(normalizeContextStats(values.context_stats));
    if (typeof values.assistant_response === "string") setAssistantResponse(values.assistant_response);
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.last_compaction_run_id === "string") setLastCompactionRunId(values.last_compaction_run_id);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "context_status") return;
    const event = normalizeContextEvents([data])[0];
    setContextEvents((current) => mergeEvents(current, [event]));
  }

  async function ensureThread(label: string) {
    if (threadId) return threadId;
    const thread = await client.threads.create({
      metadata: { example: "19-long-context-ui", label },
    });
    const nextThreadId = String(thread.thread_id);
    setThreadId(nextThreadId);
    return nextThreadId;
  }

  async function reloadState() {
    if (!threadId) return;
    setBusy(true);
    setError("");
    setStatus("Loading context state");
    try {
      const state = await client.threads.getState(threadId);
      applyValues(valuesOf(state));
      setStatus("Context state loaded");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("State load failed");
    } finally {
      setBusy(false);
    }
  }

  async function runMessages(inputMessages: string[], label: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(`Preparing ${label}`);

    try {
      const activeThreadId =
        label === "seed conversation"
          ? String(
              (
                await client.threads.create({
                  metadata: { example: "19-long-context-ui", label },
                })
              ).thread_id,
            )
          : await ensureThread(label);
      setThreadId(activeThreadId);
      setStatus(`Streaming ${label}`);

      const stream = await client.runs.stream(activeThreadId, "long_context", {
        input: {
          messages: inputMessages.map((content) => ({ type: "human", content })),
        },
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 140));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(activeThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function createThread() {
    setBusy(true);
    setError("");
    setStatus("Creating context thread");
    try {
      const thread = await client.threads.create({
        metadata: { example: "19-long-context-ui", label: "manual" },
      });
      resetState();
      setThreadId(String(thread.thread_id));
      setStatus("Context thread ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Thread create failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = followUp.trim();
    if (!trimmed) return;
    await runMessages([trimmed], "follow-up message");
  }

  const latestRecord = summaryRecords.at(-1) ?? null;

  return (
    <section className="long-context-layout">
      <aside className="long-context-control">
        <div className="panel-title">
          <Archive aria-hidden="true" size={18} />
          Context Thread
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={createThread} disabled={busy}>
            <MessageSquarePlus size={16} />
            New context thread
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void runMessages(seedMessages, "seed conversation")}
            disabled={busy}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Scissors size={16} />}
            Seed long conversation
          </button>
          <button type="button" className="secondary-button" onClick={reloadState} disabled={!threadId || busy}>
            <RefreshCw size={16} />
            Reload state
          </button>
          <button type="button" className="secondary-button" onClick={resetState} disabled={busy}>
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        <form onSubmit={sendFollowUp} className="run-form">
          <label className="field">
            <span>Follow-up message</span>
            <textarea value={followUp} onChange={(event) => setFollowUp(event.target.value)} rows={4} />
          </label>
          <button type="submit" className="primary-button" disabled={busy || !followUp.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
            Send message
          </button>
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
            <span>Compaction</span>
            <strong>{lastCompactionRunId || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className="context-budget-panel" role="region" aria-label="Context Budget">
        <div className="panel-title">
          <Clock3 aria-hidden="true" size={18} />
          Context Budget
        </div>
        <div className="budget-grid">
          <div>
            <span>Summarize After</span>
            <strong>{contextStats.summarizeAfter}</strong>
          </div>
          <div>
            <span>Keep Recent</span>
            <strong>{contextStats.keepRecent}</strong>
          </div>
          <div>
            <span>Retained Messages</span>
            <strong>{contextStats.retainedMessageCount || messages.length}</strong>
          </div>
          <div>
            <span>Summarized Messages</span>
            <strong>{contextStats.summarizedMessageCount || summarizedMessages.length}</strong>
          </div>
          <div>
            <span>Summary Records</span>
            <strong>{contextStats.summaryRecordCount || summaryRecords.length}</strong>
          </div>
          <div>
            <span>Triggered</span>
            <strong>{contextStats.compactionTriggered || summary ? "yes" : "no"}</strong>
          </div>
        </div>
      </div>

      <div className="summary-panel" role="region" aria-label="Summary of Earlier Context">
        <div className="panel-title">Summary of Earlier Context</div>
        {summary ? <div className="answer-box compact-answer">{summary}</div> : <p className="muted">No summary yet.</p>}
        {summaryMetadata ? (
          <dl className="summary-metadata">
            <div>
              <dt>Created</dt>
              <dd>{summaryMetadata.createdAt}</dd>
            </div>
            <div>
              <dt>Source Range</dt>
              <dd>{summaryMetadata.sourceMessageRange}</dd>
            </div>
            <div>
              <dt>Removed</dt>
              <dd>{summaryMetadata.sourceCount}</dd>
            </div>
            <div>
              <dt>Retained</dt>
              <dd>{summaryMetadata.retainedCount}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="recent-messages-panel" role="region" aria-label="Recent Messages">
        <div className="panel-title">Recent Messages</div>
        <div className="message-list compact-messages">
          {messages.length === 0 ? (
            <p className="muted">Seed the long conversation to see retained messages.</p>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={`message-bubble ${message.role}`}>
                <span>{message.role}</span>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="summarized-messages-panel" role="region" aria-label="Summarized Messages">
        <div className="panel-title">Summarized Messages</div>
        <div className="summarized-message-list">
          {summarizedMessages.length === 0 ? (
            <p className="muted">Removed messages will remain traceable here.</p>
          ) : (
            summarizedMessages.map((message) => (
              <article key={`${message.id}-${message.index}`} className="summarized-message">
                <span>#{message.index} {message.role}</span>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="context-events-panel" role="region" aria-label="Compaction Events">
        <div className="panel-title">Compaction Events</div>
        <div className="context-event-list">
          {contextEvents.length === 0 ? (
            <p className="muted">No context events yet.</p>
          ) : (
            contextEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className={`context-event ${event.status}`}>
                <strong>{event.phase}</strong>
                <code>{event.status}</code>
                <p>{event.detail}</p>
                <small>
                  retained {event.retainedCount} / removed {event.removedCount}
                </small>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="assistant-answer-panel" role="region" aria-label="Assistant Answer">
        <div className="panel-title">Assistant Answer</div>
        <div className="answer-box compact-answer">{final || assistantResponse || "No assistant answer yet."}</div>
      </div>

      <div className="summary-record-panel" role="region" aria-label="Latest Summary Record">
        <div className="panel-title">Latest Summary Record</div>
        {latestRecord ? (
          <pre>{formatJson(latestRecord)}</pre>
        ) : (
          <p className="muted">No summary record yet.</p>
        )}
      </div>

      <div className="state-panel long-context-final-state" role="region" aria-label="Final State">
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

