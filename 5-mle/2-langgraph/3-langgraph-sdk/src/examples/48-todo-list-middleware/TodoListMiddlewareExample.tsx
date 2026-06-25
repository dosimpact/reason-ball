import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  ListTodo,
  Loader2,
  Play,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  StreamLogEntry,
  createClientId,
  createLangGraphClient,
  langGraphApiUrl,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

type JsonRecord = Record<string, unknown>;
type TodoStatus = "pending" | "in_progress" | "completed";

type TodoItem = {
  id: string;
  content: string;
  status: TodoStatus;
  updatedAt: string;
  source: string;
};

type TranscriptItem = {
  id: string;
  role: "human" | "assistant" | "tool" | "todo";
  content: string;
  todos?: TodoItem[];
};

type ToolActivity = {
  id: string;
  name: string;
  status: "running" | "success" | "error";
  args?: unknown;
  result?: string;
  updatedAt: string;
};

const samplePrompts = [
  "Plan and complete a three-step LangGraph SDK todo list demo.",
  "Create a release readiness checklist, update each todo, and summarize the final state.",
];

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

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (isRecord(item) && typeof item.text === "string") return item.text;
        if (isRecord(item) && typeof item.content === "string") return item.content;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function normalizeTodoStatus(value: unknown): TodoStatus {
  if (value === "pending" || value === "in_progress" || value === "completed") {
    return value;
  }
  return "pending";
}

function normalizeTodos(value: unknown, source: string, updatedAt: string): TodoItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((todo, index) => ({
    id: `${index}-${String(todo.content ?? `Todo ${index + 1}`)}`,
    content: typeof todo.content === "string" ? todo.content : `Todo ${index + 1}`,
    status: normalizeTodoStatus(todo.status),
    updatedAt,
    source,
  }));
}

function extractMessages(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(extractMessages);
  if (!isRecord(value)) return [];

  const maybeType = value.type ?? value.role;
  if (typeof maybeType === "string" && ("content" in value || "tool_calls" in value)) {
    return [value];
  }

  if (Array.isArray(value.messages)) return value.messages.flatMap(extractMessages);

  return Object.values(value).flatMap(extractMessages);
}

function toolCallsFromMessage(message: JsonRecord): JsonRecord[] {
  if (Array.isArray(message.tool_calls)) return message.tool_calls.filter(isRecord);

  const additional = message.additional_kwargs;
  if (isRecord(additional) && Array.isArray(additional.tool_calls)) {
    return additional.tool_calls.filter(isRecord);
  }

  return [];
}

function toolCallIdOf(call: JsonRecord, fallback: string): string {
  return String(call.id ?? call.tool_call_id ?? fallback);
}

function toolNameOf(call: JsonRecord): string {
  if (typeof call.name === "string") return call.name;
  if (isRecord(call.function) && typeof call.function.name === "string") return call.function.name;
  return "tool";
}

function toolArgsOf(call: JsonRecord): unknown {
  if ("args" in call) return call.args;
  if (isRecord(call.function) && typeof call.function.arguments === "string") {
    try {
      return JSON.parse(call.function.arguments);
    } catch {
      return call.function.arguments;
    }
  }
  return {};
}

function upsertTranscript(items: TranscriptItem[], next: TranscriptItem): TranscriptItem[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) return [...items, next];
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item));
}

function upsertToolActivity(items: ToolActivity[], next: ToolActivity): ToolActivity[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) return [next, ...items];
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item));
}

function latestToolActivity(items: ToolActivity[], toolCallId: string): ToolActivity | undefined {
  return items.find((item) => item.id === toolCallId) ?? items[0];
}

function statusIcon(status: TodoStatus) {
  if (status === "completed") return <CheckCircle2 aria-hidden="true" size={16} />;
  if (status === "in_progress") return <Clock3 aria-hidden="true" size={16} />;
  return <Circle aria-hidden="true" size={16} />;
}

export function TodoListMiddlewareExample() {
  const [prompt, setPrompt] = useState(samplePrompts[0]);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const counts = useMemo(
    () => ({
      pending: todos.filter((todo) => todo.status === "pending").length,
      inProgress: todos.filter((todo) => todo.status === "in_progress").length,
      completed: todos.filter((todo) => todo.status === "completed").length,
    }),
    [todos],
  );
  const middlewareErrors = toolActivities.filter((activity) => activity.status === "error");

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setTodos([]);
    setTranscript([]);
    setToolActivities([]);
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyMessages(messages: JsonRecord[], receivedAt: string) {
    for (const message of messages) {
      const type = String(message.type ?? message.role ?? "").toLowerCase();
      const text = contentToText(message.content);

      if (type.includes("ai") || type === "assistant") {
        const calls = toolCallsFromMessage(message);
        if (calls.length > 0) {
          setToolActivities((current) =>
            calls.reduce((activities, call, index) => {
              const id = toolCallIdOf(call, `tool-${index}`);
              return upsertToolActivity(activities, {
                id,
                name: toolNameOf(call),
                args: toolArgsOf(call),
                status: "running",
                updatedAt: receivedAt,
              });
            }, current),
          );
        }

        if (text) {
          setTranscript((current) =>
            upsertTranscript(current, {
              id: String(message.id ?? createClientId("assistant")),
              role: "assistant",
              content: text,
            }),
          );
        }
      }

      if (type.includes("tool")) {
        const toolCallId = String(message.tool_call_id ?? message.id ?? "");
        const result = text || JSON.stringify(message.content ?? "");
        const isError = message.status === "error" || result.toLowerCase().startsWith("error");
        const isTodoUpdate = String(message.name ?? "").includes("write_todos")
          && result.startsWith("Updated todo list");

        if (isError || !isTodoUpdate) {
          setTranscript((current) =>
            upsertTranscript(current, {
              id: String((message.id ?? toolCallId) || createClientId("tool-message")),
              role: "tool",
              content: result,
            }),
          );
        }
        setToolActivities((current) => {
          const existing = latestToolActivity(current, toolCallId);
          return upsertToolActivity(current, {
            id: toolCallId || existing?.id || createClientId("tool"),
            name: String(message.name ?? existing?.name ?? "write_todos"),
            args: existing?.args,
            status: isError ? "error" : "success",
            result,
            updatedAt: receivedAt,
          });
        });
      }
    }
  }

  function applyValues(values: JsonRecord, source: string, receivedAt: string) {
    if (Array.isArray(values.todos)) {
      const nextTodos = normalizeTodos(values.todos, source, receivedAt);
      setTodos(nextTodos);
      setTranscript((current) =>
        upsertTranscript(current, {
          id: "inline-todo-state",
          role: "todo",
          content: "Todo list",
          todos: nextTodos,
        }),
      );
    }
    if (Array.isArray(values.messages)) {
      applyMessages(extractMessages(values.messages), receivedAt);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  async function runTodoList(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setTodos([]);
    setTranscript([{ id: createClientId("human"), role: "human", content: trimmed }]);
    setToolActivities([]);
    setFinalState(null);
    setStatus("Creating todo thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "48-todo-list-middleware" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming todo middleware");

      const stream = await client.runs.stream(nextThreadId, "todo_list_middleware", {
        input: { messages: [{ type: "human", content: trimmed }] },
        streamMode: ["updates", "values"] as ["updates", "values"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 140));

        if (logEntry.event === "values") {
          applyValues(valuesOf(logEntry.data), "values", logEntry.receivedAt);
        }
        if (logEntry.event === "updates") {
          for (const payload of nodePayloads(logEntry.data)) {
            applyValues(payload, "updates", logEntry.receivedAt);
          }
          applyMessages(extractMessages(logEntry.data), logEntry.receivedAt);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state), "final state", new Date().toLocaleTimeString());
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="todo-layout">
      <aside className="todo-control">
        <div className="panel-title">
          <ListTodo aria-hidden="true" size={18} />
          Todo Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="sample-list" aria-label="Todo prompt samples">
          {samplePrompts.map((sample) => (
            <button
              key={sample}
              type="button"
              className="sample-button"
              onClick={() => setPrompt(sample)}
              disabled={busy}
            >
              {sample}
            </button>
          ))}
        </div>
        <form className="run-form" onSubmit={runTodoList}>
          <label className="field">
            <span>Prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !prompt.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run todo list
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
            <span>Thread</span>
            <strong>{threadId || "none"}</strong>
          </div>
          <div>
            <span>Todos</span>
            <strong>{todos.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className="todo-status-panel" role="region" aria-label="Todo Status">
        <div className="panel-title">Todo Status</div>
        <div className="todo-status-grid">
          <div>
            <span>Pending</span>
            <strong>{counts.pending}</strong>
          </div>
          <div>
            <span>In Progress</span>
            <strong>{counts.inProgress}</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>{counts.completed}</strong>
          </div>
        </div>
      </div>

      <div className="todo-chat-panel" role="region" aria-label="Todo Transcript">
        <div className="panel-title">Todo Transcript</div>
        <div className="message-list todo-message-list">
          {transcript.length === 0 ? (
            <p className="muted">Run the graph to see middleware messages.</p>
          ) : (
            transcript.map((message) => (
              message.role === "todo" ? (
                <article key={message.id} className="message-bubble ai todo-inline-message">
                  <span>todo</span>
                  <ul className="todo-inline-list" aria-label="Inline todo list">
                    {(message.todos ?? []).map((todo) => (
                      <li key={todo.id} className={`todo-inline-item ${todo.status}`}>
                        {statusIcon(todo.status)}
                        <span>{todo.content}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : (
                <article
                  key={message.id}
                  className={`message-bubble ${message.role === "human" ? "human" : "ai"} todo-message-${message.role}`}
                >
                  <span>{message.role}</span>
                  <p>{message.content}</p>
                </article>
              )
            ))
          )}
        </div>
      </div>

      <div className="todo-board-panel" role="region" aria-label="Todo List">
        <div className="panel-title">
          <ListTodo aria-hidden="true" size={18} />
          Todo List
        </div>
        {middlewareErrors.length > 0 ? (
          <div className="todo-warning" role="alert">
            <AlertTriangle aria-hidden="true" size={16} />
            <span>{middlewareErrors[0].result}</span>
          </div>
        ) : null}
        <div className="todo-board-list">
          {todos.length === 0 ? (
            <p className="muted">No todo state yet.</p>
          ) : (
            todos.map((todo, index) => (
              <article key={todo.id} className={`todo-row ${todo.status}`}>
                <div className="todo-row-index">{index + 1}</div>
                <div className="todo-row-body">
                  <strong>{todo.content}</strong>
                  <div>
                    <span className="todo-status-chip">
                      {statusIcon(todo.status)}
                      {todo.status}
                    </span>
                    <code>{todo.source}</code>
                    <span>{todo.updatedAt}</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="todo-tool-panel" role="region" aria-label="write_todos Tool Calls">
        <div className="panel-title">
          <Wrench aria-hidden="true" size={18} />
          write_todos Calls
        </div>
        <div className="todo-tool-list">
          {toolActivities.length === 0 ? (
            <p className="muted">No tool activity yet.</p>
          ) : (
            toolActivities.map((activity) => (
              <article key={activity.id} className={`tool-card ${activity.status}`}>
                <div className="tool-card-header">
                  <div>
                    <strong>{activity.name}</strong>
                    <code>{activity.id}</code>
                  </div>
                  <span className="tool-status">{activity.status}</span>
                </div>
                <div className="tool-card-grid">
                  <div>
                    <span>Arguments</span>
                    <pre>{formatJson(activity.args ?? {})}</pre>
                  </div>
                  <div>
                    <span>{activity.status === "error" ? "Error" : "Result"}</span>
                    <pre>{activity.result ?? "Waiting for middleware tool result"}</pre>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel todo-final-state" role="region" aria-label="Final State">
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
