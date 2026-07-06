import {
  Activity,
  CheckCircle2,
  GitBranch,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  TimerReset,
  Webhook,
  Wrench,
  XCircle,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  StreamLogEntry,
  createLangGraphClient,
  langGraphApiUrl,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

type JsonRecord = Record<string, unknown>;
type TriggerType = "manual" | "webhook" | "cron";
type Verdict = "PASS" | "FAIL";

type AttemptRecord = {
  attempt: number;
  draft: string;
  status: string;
  toolCallIds: string[];
  changesFromFeedback: string[];
};

type ToolCallRecord = {
  id: string;
  attempt: number;
  name: string;
  args: unknown;
  result: string;
};

type VerificationRecord = {
  attempt: number;
  verdict: Verdict;
  score: number;
  threshold: number;
  feedback: string;
  retryReason: string;
};

type TraceEvent = {
  loop: string;
  phase: string;
  status: string;
  detail: string;
  attempt: number;
};

type ImprovementSuggestion = {
  area: string;
  suggestion: string;
  evidence: string;
};

const sampleTasks = [
  "Improve a release note for developers explaining how loop engineering makes LangGraph agents easier to verify, operate, and improve.",
  "Rewrite a team update so it explains why agent traces should feed future prompt and rubric changes.",
];

const loopCards = [
  {
    id: "event-driven",
    title: "Event-driven loop",
    detail: "Normalizes manual, webhook, or cron triggers before work begins.",
    icon: Webhook,
  },
  {
    id: "agent",
    title: "Agent loop",
    detail: "Uses local tool context and prior feedback to produce each attempt.",
    icon: Wrench,
  },
  {
    id: "verification",
    title: "Verification loop",
    detail: "Scores attempts against a threshold and routes retries.",
    icon: GitBranch,
  },
  {
    id: "hill-climbing",
    title: "Hill-climbing loop",
    detail: "Turns traces and eval results into improvement suggestions.",
    icon: Sparkles,
  },
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

function normalizeStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeAttempts(value: unknown): AttemptRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item, index) => ({
    attempt: typeof item.attempt === "number" ? item.attempt : index + 1,
    draft: typeof item.draft === "string" ? item.draft : "",
    status: typeof item.status === "string" ? item.status : "",
    toolCallIds: normalizeStringList(item.tool_call_ids ?? item.toolCallIds),
    changesFromFeedback: normalizeStringList(item.changes_from_feedback ?? item.changesFromFeedback),
  }));
}

function normalizeToolCalls(value: unknown): ToolCallRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item, index) => ({
    id: typeof item.id === "string" ? item.id : `tool-${index + 1}`,
    attempt: typeof item.attempt === "number" ? item.attempt : 0,
    name: typeof item.name === "string" ? item.name : "tool",
    args: item.args ?? {},
    result: typeof item.result === "string" ? item.result : "",
  }));
}

function normalizeVerifications(value: unknown): VerificationRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item, index) => ({
    attempt: typeof item.attempt === "number" ? item.attempt : index + 1,
    verdict: item.verdict === "PASS" ? "PASS" : "FAIL",
    score: typeof item.score === "number" ? item.score : 0,
    threshold: typeof item.threshold === "number" ? item.threshold : 4,
    feedback: typeof item.feedback === "string" ? item.feedback : "",
    retryReason: typeof item.retry_reason === "string" ? item.retry_reason : "",
  }));
}

function normalizeTraceEvents(value: unknown): TraceEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    loop: typeof item.loop === "string" ? item.loop : "agent",
    phase: typeof item.phase === "string" ? item.phase : "event",
    status: typeof item.status === "string" ? item.status : "unknown",
    detail: typeof item.detail === "string" ? item.detail : "",
    attempt: typeof item.attempt === "number" ? item.attempt : 0,
  }));
}

function normalizeSuggestions(value: unknown): ImprovementSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    area: typeof item.area === "string" ? item.area : "harness",
    suggestion: typeof item.suggestion === "string" ? item.suggestion : "",
    evidence: typeof item.evidence === "string" ? item.evidence : "",
  }));
}

export function LoopEngineeringHarnessExample() {
  const [task, setTask] = useState(sampleTasks[0]);
  const [triggerType, setTriggerType] = useState<TriggerType>("webhook");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [qualityThreshold, setQualityThreshold] = useState(4);
  const [status, setStatus] = useState("Idle");
  const [threadId, setThreadId] = useState("");
  const [activeLoop, setActiveLoop] = useState("");
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [stopReason, setStopReason] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const latestVerification = verifications.at(-1);

  function resetView() {
    setStatus("Idle");
    setThreadId("");
    setActiveLoop("");
    setAttempts([]);
    setToolCalls([]);
    setVerifications([]);
    setTraceEvents([]);
    setSuggestions([]);
    setFinalAnswer("");
    setStopReason("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (Array.isArray(values.attempts)) setAttempts(normalizeAttempts(values.attempts));
    if (Array.isArray(values.tool_calls)) setToolCalls(normalizeToolCalls(values.tool_calls));
    if (Array.isArray(values.verification_results)) {
      setVerifications(normalizeVerifications(values.verification_results));
    }
    if (Array.isArray(values.trace_events)) setTraceEvents(normalizeTraceEvents(values.trace_events));
    if (Array.isArray(values.improvement_suggestions)) {
      setSuggestions(normalizeSuggestions(values.improvement_suggestions));
    }
    if (typeof values.final_answer === "string") setFinalAnswer(values.final_answer);
    if (typeof values.stop_reason === "string") setStopReason(values.stop_reason);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "loop_engineering_event") return;
    const event = normalizeTraceEvents([data])[0];
    setActiveLoop(event.loop);
    setTraceEvents((current) => [...current, event]);
  }

  async function runHarness(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = task.trim();
    if (!trimmed) return;

    setBusy(true);
    resetView();
    setStatus("Creating harness thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "49-loop-engineering-harness-ui" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming loop harness");

      const stream = await client.runs.stream(nextThreadId, "loop_engineering_harness", {
        input: {
          task: trimmed,
          trigger_type: triggerType,
          max_attempts: maxAttempts,
          quality_threshold: qualityThreshold,
        },
        streamMode: ["updates", "values", "custom"] as ["updates", "values", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 160));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        if (logEntry.event === "values") applyValues(valuesOf(logEntry.data));
        if (logEntry.event === "updates") {
          for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="artifact-layout">
      <aside className="artifact-chat-panel">
        <div className="panel-title">
          <Activity aria-hidden="true" size={18} />
          Harness Controls
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="sample-list" aria-label="Task samples">
          {sampleTasks.map((sample) => (
            <button
              key={sample}
              type="button"
              className="sample-button"
              onClick={() => setTask(sample)}
              disabled={busy}
            >
              {sample}
            </button>
          ))}
        </div>
        <form className="run-form" onSubmit={runHarness}>
          <label className="field">
            <span>Trigger</span>
            <select value={triggerType} onChange={(event) => setTriggerType(event.target.value as TriggerType)}>
              <option value="manual">manual</option>
              <option value="webhook">webhook</option>
              <option value="cron">cron</option>
            </select>
          </label>
          <label className="field">
            <span>Task</span>
            <textarea value={task} onChange={(event) => setTask(event.target.value)} rows={6} />
          </label>
          <div className="two-column-grid">
            <label className="field">
              <span>Max Attempts</span>
              <input
                type="number"
                min={1}
                max={4}
                value={maxAttempts}
                onChange={(event) => setMaxAttempts(Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Quality Threshold</span>
              <input
                type="number"
                min={1}
                max={5}
                value={qualityThreshold}
                onChange={(event) => setQualityThreshold(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !task.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run harness
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
            <span>Attempts</span>
            <strong>{attempts.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className="artifact-canvas-panel">
        <div className="panel-title">Loop Stack</div>
        <div className="metric-grid">
          {loopCards.map((loop) => {
            const Icon = loop.icon;
            const isActive = activeLoop === loop.id;
            const hasTrace = traceEvents.some((event) => event.loop === loop.id);
            return (
              <article key={loop.id} className={isActive ? "metric-card active" : "metric-card"}>
                <Icon aria-hidden="true" size={18} />
                <span>{loop.title}</span>
                <strong>{hasTrace ? "seen" : "waiting"}</strong>
                <p>{loop.detail}</p>
              </article>
            );
          })}
        </div>

        <div className="artifact-section">
          <div className="panel-title">
            <TimerReset aria-hidden="true" size={18} />
            Attempt Timeline
          </div>
          {attempts.length === 0 ? (
            <p className="muted">Run the graph to see retry attempts.</p>
          ) : (
            attempts.map((attempt) => {
              const verification = verifications.find((item) => item.attempt === attempt.attempt);
              return (
                <article key={attempt.attempt} className="event-row">
                  <summary>
                    <span>Attempt {attempt.attempt}</span>
                    <strong>{verification?.verdict ?? attempt.status}</strong>
                  </summary>
                  <p>{attempt.draft}</p>
                  {verification ? (
                    <div className="runtime-facts">
                      <div>
                        <span>Score</span>
                        <strong>{verification.score}/{verification.threshold}</strong>
                      </div>
                      <div>
                        <span>Verdict</span>
                        <strong>{verification.verdict}</strong>
                      </div>
                      <div>
                        <span>Retry</span>
                        <strong>{verification.retryReason || "none"}</strong>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>

        <div className="artifact-section">
          <div className="panel-title">
            {latestVerification?.verdict === "PASS" ? (
              <CheckCircle2 aria-hidden="true" size={18} />
            ) : (
              <XCircle aria-hidden="true" size={18} />
            )}
            Final Output
          </div>
          <p>{finalAnswer || "No final answer yet."}</p>
          <code>{stopReason || "no stop reason"}</code>
        </div>
      </div>

      <aside className="artifact-inspector-panel">
        <div className="panel-title">
          <Sparkles aria-hidden="true" size={18} />
          Hill-Climbing Suggestions
        </div>
        {suggestions.length === 0 ? (
          <p className="muted">Suggestions appear after trace analysis.</p>
        ) : (
          suggestions.map((suggestion) => (
            <article key={suggestion.area} className="tool-card success">
              <div className="tool-card-header">
                <strong>{suggestion.area}</strong>
                <span className="tool-status">improve</span>
              </div>
              <p>{suggestion.suggestion}</p>
              <small>{suggestion.evidence}</small>
            </article>
          ))
        )}

        <div className="panel-title">Tool Calls</div>
        <div className="event-list compact">
          {toolCalls.length === 0 ? (
            <p className="muted">No tool calls yet.</p>
          ) : (
            toolCalls.map((call) => (
              <details key={call.id} className="event-row">
                <summary>
                  <span>Attempt {call.attempt}</span>
                  <strong>{call.name}</strong>
                </summary>
                <pre>{formatJson(call)}</pre>
              </details>
            ))
          )}
        </div>

        <div className="panel-title">Trace Events</div>
        <div className="event-list compact">
          {traceEvents.length === 0 ? (
            <p className="muted">No trace events yet.</p>
          ) : (
            traceEvents.map((event, index) => (
              <article key={`${event.loop}-${event.phase}-${index}`} className="event-row">
                <summary>
                  <span>{event.loop}</span>
                  <strong>{event.phase}</strong>
                </summary>
                <p>{event.detail}</p>
              </article>
            ))
          )}
        </div>
      </aside>

      <div className="state-panel">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
      </div>

      <div className="event-panel">
        <div className="panel-title">Raw Stream Events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No stream events yet.</p>
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
