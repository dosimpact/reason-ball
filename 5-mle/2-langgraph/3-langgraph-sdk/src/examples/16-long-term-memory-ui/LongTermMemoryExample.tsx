import { Database, GitBranch, Loader2, Play, RotateCcw, Save, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";


const samples = [
  {
    label: "Concise examples",
    key: "preference-style",
    value: "The learner prefers concise examples with visible graph state.",
  },
  {
    label: "Seoul timezone",
    key: "timezone",
    value: "The learner works from Seoul and prefers dates shown with Korea time context.",
  },
  {
    label: "Debug focus",
    key: "debug-focus",
    value: "The learner wants memory, checkpoint, and stream events separated in the UI.",
  },
];

type JsonRecord = Record<string, unknown>;
type MemoryAction = "create" | "update" | "delete" | "recall";

type MemoryRecord = {
  id: string;
  content: string;
  namespace: string;
  userId: string;
  source: string;
};

type MemoryOperation = {
  action: string;
  memoryId: string;
  content: string;
  status: string;
  detail: string;
};

type MemoryEvent = {
  type: string;
  action: string;
  userId: string;
  memoryId: string;
  detail: string;
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

function normalizeStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeMemories(value: unknown): MemoryRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((memory, index) => ({
    id: typeof memory.id === "string" ? memory.id : `memory-${index + 1}`,
    content: typeof memory.content === "string" ? memory.content : "",
    namespace: typeof memory.namespace === "string" ? memory.namespace : "",
    userId: typeof memory.user_id === "string" ? memory.user_id : String(memory.userId ?? ""),
    source: typeof memory.source === "string" ? memory.source : "BaseStore",
  }));
}

function normalizeOperations(value: unknown): MemoryOperation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((operation) => ({
    action: typeof operation.action === "string" ? operation.action : "recall",
    memoryId:
      typeof operation.memory_id === "string"
        ? operation.memory_id
        : String(operation.memoryId ?? ""),
    content: typeof operation.content === "string" ? operation.content : "",
    status: typeof operation.status === "string" ? operation.status : "",
    detail: typeof operation.detail === "string" ? operation.detail : "",
  }));
}

function normalizeMemoryEvents(value: unknown): MemoryEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "memory_operation",
    action: typeof event.action === "string" ? event.action : "recall",
    userId: typeof event.user_id === "string" ? event.user_id : String(event.userId ?? ""),
    memoryId:
      typeof event.memory_id === "string" ? event.memory_id : String(event.memoryId ?? ""),
    detail: typeof event.detail === "string" ? event.detail : "",
  }));
}

function mergeOperations(current: MemoryOperation[], next: MemoryOperation[]) {
  const seen = new Set<string>();
  return [...current, ...next]
    .filter((operation) => {
      const key = `${operation.action}:${operation.memoryId}:${operation.status}:${operation.detail}:${operation.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-40);
}

function mergeMemoryEvents(current: MemoryEvent[], next: MemoryEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next]
    .filter((event) => {
      const key = `${event.action}:${event.userId}:${event.memoryId}:${event.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-60);
}

export function LongTermMemoryExample() {
  const [userId, setUserId] = useState("learner-001");
  const [memoryId, setMemoryId] = useState(samples[0].key);
  const [content, setContent] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [lastMutationThreadId, setLastMutationThreadId] = useState("");
  const [crossThreadId, setCrossThreadId] = useState("");
  const [otherUserThreadId, setOtherUserThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [operations, setOperations] = useState<MemoryOperation[]>([]);
  const [memoryEvents, setMemoryEvents] = useState<MemoryEvent[]>([]);
  const [threadNotes, setThreadNotes] = useState<string[]>([]);
  const [namespace, setNamespace] = useState<string[]>([]);
  const [assistantResponse, setAssistantResponse] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [proofMessage, setProofMessage] = useState("Create a memory, then recall it in a new thread.");
  const [proofMemories, setProofMemories] = useState<MemoryRecord[]>([]);
  const [otherUserMemoryCount, setOtherUserMemoryCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const selectedMemory = memories.find((memory) => memory.id === memoryId) ?? null;
  const latestOperation = operations.at(-1) ?? null;

  function resetView() {
    setThreadId("");
    setLastMutationThreadId("");
    setCrossThreadId("");
    setOtherUserThreadId("");
    setStatus("Idle");
    setMemories([]);
    setOperations([]);
    setMemoryEvents([]);
    setThreadNotes([]);
    setNamespace([]);
    setAssistantResponse("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setProofMessage("Create a memory, then recall it in a new thread.");
    setProofMemories([]);
    setOtherUserMemoryCount(null);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (Array.isArray(values.memories)) {
      setMemories(normalizeMemories(values.memories));
    }
    if (Array.isArray(values.memory_operations)) {
      setOperations((current) => mergeOperations(current, normalizeOperations(values.memory_operations)));
    }
    if (Array.isArray(values.memory_events)) {
      setMemoryEvents((current) => mergeMemoryEvents(current, normalizeMemoryEvents(values.memory_events)));
    }
    if (Array.isArray(values.thread_notes)) {
      setThreadNotes(normalizeStringList(values.thread_notes));
    }
    if (Array.isArray(values.namespace)) {
      setNamespace(normalizeStringList(values.namespace));
    }
    if (typeof values.assistant_response === "string") {
      setAssistantResponse(values.assistant_response);
    }
    if (typeof values.final === "string") {
      setFinal(values.final);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "memory_operation") return;
    const event = normalizeMemoryEvents([data])[0];
    setMemoryEvents((current) => mergeMemoryEvents(current, [event]));
  }

  async function runMemoryAction(
    action: MemoryAction,
    options: {
      newThread?: boolean;
      overrideUserId?: string;
      overrideThreadLabel?: string;
      trackProof?: boolean;
      trackOtherUser?: boolean;
    } = {},
  ) {
    const activeUserId = (options.overrideUserId ?? userId).trim();
    const activeMemoryId = memoryId.trim();
    const activeContent = content.trim();
    if (!activeUserId) return;
    if ((action === "create" || action === "update") && (!activeMemoryId || !activeContent)) return;
    if (action === "delete" && !activeMemoryId) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(`Preparing ${action}`);

    try {
      let activeThreadId = threadId;
      if (options.newThread || !activeThreadId) {
        const thread = await client.threads.create({
          metadata: { example: "16-long-term-memory-ui", userId: activeUserId, action },
        });
        activeThreadId = String(thread.thread_id);
      }

      setThreadId(activeThreadId);
      if (action !== "recall") {
        setLastMutationThreadId(activeThreadId);
      }
      if (options.trackProof) {
        setCrossThreadId(activeThreadId);
      }
      if (options.trackOtherUser) {
        setOtherUserThreadId(activeThreadId);
      }

      setStatus(`Streaming ${action}`);
      const stream = await client.runs.stream(activeThreadId, "16_long_term_memory", {
        input: {
          user_id: activeUserId,
          action,
          memory_id: activeMemoryId,
          content: action === "delete" ? "" : activeContent,
          thread_label:
            options.overrideThreadLabel ??
            (options.newThread ? "New thread recall" : "Primary thread"),
        },
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 120));
        if (logEntry.event === "custom") {
          applyCustomEvent(logEntry.data);
        }
        for (const payload of nodePayloads(logEntry.data)) {
          applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(activeThreadId);
      const values = valuesOf(state);
      applyValues(values);
      const memoryCount = Array.isArray(values.memories) ? values.memories.length : 0;
      if (options.trackProof) {
        setProofMemories(normalizeMemories(values.memories));
        setProofMessage(
          `New thread ${activeThreadId} recalled ${memoryCount} durable memories for ${activeUserId}.`,
        );
      }
      if (options.trackOtherUser) {
        setProofMemories(normalizeMemories(values.memories));
        setProofMessage(`Other user ${activeUserId} returned ${memoryCount} durable memories.`);
        setOtherUserMemoryCount(memoryCount);
      }
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  function runCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runMemoryAction("create");
  }

  function selectMemory(memory: MemoryRecord) {
    setMemoryId(memory.id);
    setContent(memory.content);
  }

  return (
    <section className="memory-layout">
      <aside className="memory-control" role="region" aria-label="Memory Editor">
        <div className="panel-title">
          <Database aria-hidden="true" size={18} />
          Memory Editor
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <label className="field">
          <span>User ID</span>
          <input value={userId} onChange={(event) => setUserId(event.target.value)} />
        </label>
        <div className="sample-list" aria-label="Memory samples">
          {samples.map((sample) => (
            <button
              key={sample.key}
              type="button"
              className="sample-button"
              onClick={() => {
                setMemoryId(sample.key);
                setContent(sample.value);
              }}
              disabled={busy}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <form onSubmit={runCreate} className="run-form">
          <label className="field">
            <span>Memory ID</span>
            <input value={memoryId} onChange={(event) => setMemoryId(event.target.value)} />
          </label>
          <label className="field">
            <span>Memory Content</span>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} />
          </label>
          <div className="memory-button-grid">
            <button type="submit" className="primary-button" disabled={busy || !memoryId.trim() || !content.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
              Create memory
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void runMemoryAction("update")}
              disabled={busy || !memoryId.trim() || !content.trim()}
            >
              <Save size={16} />
              Update memory
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void runMemoryAction("delete")}
              disabled={busy || !memoryId.trim()}
            >
              <Trash2 size={16} />
              Delete memory
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void runMemoryAction("recall")}
              disabled={busy || !userId.trim()}
            >
              <Play size={16} />
              Recall memories
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void runMemoryAction("recall", {
                  newThread: true,
                  trackProof: true,
                  overrideThreadLabel: "New thread same user",
                })
              }
              disabled={busy || !userId.trim()}
            >
              <GitBranch size={16} />
              Recall in new thread
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void runMemoryAction("recall", {
                  newThread: true,
                  overrideUserId: `${userId}-other`,
                  overrideThreadLabel: "Other user isolation check",
                  trackOtherUser: true,
                })
              }
              disabled={busy || !userId.trim()}
            >
              <GitBranch size={16} />
              Recall other user
            </button>
          </div>
          <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
            <RotateCcw size={16} />
            Reset view
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
            <span>Memories</span>
            <strong>{memories.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className="durable-memory-panel" role="region" aria-label="Durable Memories">
        <div className="panel-title">Durable Memories</div>
        <p className="namespace-line">
          Namespace <code>{namespace.length > 0 ? namespace.join("/") : `memories/long-term-memory-ui/${userId}`}</code>
        </p>
        <div className="memory-list">
          {memories.length === 0 ? (
            <p className="muted">No durable memories loaded for this user.</p>
          ) : (
            memories.map((memory) => (
              <button
                key={memory.id}
                type="button"
                className={memory.id === memoryId ? "memory-item active" : "memory-item"}
                onClick={() => selectMemory(memory)}
              >
                <strong>{memory.id}</strong>
                <span>{memory.content}</span>
                <code>{memory.userId}</code>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="thread-state-panel" role="region" aria-label="Thread State">
        <div className="panel-title">Thread State</div>
        <div className="thread-state-grid">
          <div>
            <span>Current Thread</span>
            <strong>{threadId || "none"}</strong>
          </div>
          <div>
            <span>Latest Operation</span>
            <strong>{latestOperation ? `${latestOperation.action} / ${latestOperation.status}` : "none"}</strong>
          </div>
        </div>
        <div className="thread-note-list">
          {threadNotes.length === 0 ? (
            <p className="muted">Thread-local notes will appear after a run.</p>
          ) : (
            threadNotes.map((note) => <p key={note}>{note}</p>)
          )}
        </div>
      </div>

      <div className="cross-thread-panel" role="region" aria-label="Cross-thread Proof">
        <div className="panel-title">Cross-thread Proof</div>
        <div className="proof-grid">
          <div>
            <span>Mutation Thread</span>
            <strong>{lastMutationThreadId || "none"}</strong>
          </div>
          <div>
            <span>Recall Thread</span>
            <strong>{crossThreadId || "none"}</strong>
          </div>
          <div>
            <span>Other User Thread</span>
            <strong>{otherUserThreadId || "none"}</strong>
          </div>
        </div>
        <p>{proofMessage}</p>
        {proofMemories.length > 0 ? (
          <div className="proof-memory-list">
            {proofMemories.map((memory) => (
              <article key={`${memory.userId}-${memory.id}`} className="proof-memory-card">
                <strong>{memory.id}</strong>
                <span>{memory.content}</span>
                <code>{memory.userId}</code>
              </article>
            ))}
          </div>
        ) : null}
        {otherUserMemoryCount !== null ? (
          <p className="isolation-line">Other user recall returned {otherUserMemoryCount} durable memories.</p>
        ) : null}
      </div>

      <div className="memory-events-panel" role="region" aria-label="Memory Events">
        <div className="panel-title">Memory Events</div>
        <div className="memory-event-list">
          {memoryEvents.length === 0 ? (
            <p className="muted">Store operation events will appear here.</p>
          ) : (
            memoryEvents.slice(0, 12).map((event, index) => (
              <div key={`${event.action}-${event.memoryId}-${index}`} className="memory-event">
                <strong>{event.action}</strong>
                <span>{event.memoryId || event.userId}</span>
                <p>{event.detail}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box">{final || assistantResponse || "No memory response yet."}</div>
      </div>

      <div className="state-panel memory-final-state" role="region" aria-label="Final State">
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
