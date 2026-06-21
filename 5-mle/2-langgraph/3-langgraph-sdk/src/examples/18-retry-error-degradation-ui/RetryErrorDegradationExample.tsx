import { AlertTriangle, GitBranch, Loader2, Play, RotateCcw, ShieldCheck, TimerReset } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";


const samples = [
  {
    label: "SDK Outage",
    value: "Summarize retry and fallback behavior for a LangGraph SDK learning demo.",
  },
  {
    label: "Search Timeout",
    value: "Handle an upstream search timeout while still giving the learner useful partial context.",
  },
  {
    label: "Auth Failure",
    value: "Explain how a graph should surface a permanent authentication failure without hiding it.",
  },
];

const modes = [
  { label: "Normal", value: "normal", detail: "primary succeeds immediately" },
  { label: "Flaky", value: "flaky_success", detail: "two transient failures, then recovery" },
  { label: "Fallback", value: "fallback_success", detail: "primary exhausts retries, fallback succeeds" },
  { label: "Forced failure", value: "final_failure", detail: "permanent error with no fallback" },
] as const;

type FailureMode = (typeof modes)[number]["value"];
type JsonRecord = Record<string, unknown>;

type RetryAttempt = {
  attempt: number;
  status: string;
  errorType: string;
  message: string;
  recoverable: boolean;
  backoffMs: number;
  result: string;
};

type ErrorRecord = {
  node: string;
  attempt: number;
  errorType: string;
  message: string;
  recoverable: boolean;
};

type RetryEvent = {
  type: string;
  phase: string;
  attempt: number;
  status: string;
  detail: string;
  backoffMs: number;
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

function normalizeAttempts(value: unknown): RetryAttempt[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((attempt, index) => ({
    attempt: typeof attempt.attempt === "number" ? attempt.attempt : index + 1,
    status: typeof attempt.status === "string" ? attempt.status : "",
    errorType: typeof attempt.error_type === "string" ? attempt.error_type : String(attempt.errorType ?? ""),
    message: typeof attempt.message === "string" ? attempt.message : "",
    recoverable: typeof attempt.recoverable === "boolean" ? attempt.recoverable : false,
    backoffMs: typeof attempt.backoff_ms === "number" ? attempt.backoff_ms : Number(attempt.backoffMs ?? 0),
    result: typeof attempt.result === "string" ? attempt.result : "",
  }));
}

function normalizeErrors(value: unknown): ErrorRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((error, index) => ({
    node: typeof error.node === "string" ? error.node : "primary_call",
    attempt: typeof error.attempt === "number" ? error.attempt : index + 1,
    errorType: typeof error.error_type === "string" ? error.error_type : String(error.errorType ?? ""),
    message: typeof error.message === "string" ? error.message : "",
    recoverable: typeof error.recoverable === "boolean" ? error.recoverable : false,
  }));
}

function normalizeRetryEvents(value: unknown): RetryEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event, index) => ({
    type: typeof event.type === "string" ? event.type : "retry_status",
    phase: typeof event.phase === "string" ? event.phase : "event",
    attempt: typeof event.attempt === "number" ? event.attempt : index + 1,
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    backoffMs: typeof event.backoff_ms === "number" ? event.backoff_ms : Number(event.backoffMs ?? 0),
  }));
}

function mergeRetryEvents(current: RetryEvent[], next: RetryEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next]
    .filter((event) => {
      const key = `${event.phase}:${event.attempt}:${event.status}:${event.detail}:${event.backoffMs}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-80);
}

export function RetryErrorDegradationExample() {
  const [query, setQuery] = useState(samples[0].value);
  const [failureMode, setFailureMode] = useState<FailureMode>("flaky_success");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [retryStatus, setRetryStatus] = useState("idle");
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [attempts, setAttempts] = useState<RetryAttempt[]>([]);
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [retryEvents, setRetryEvents] = useState<RetryEvent[]>([]);
  const [primaryResult, setPrimaryResult] = useState("");
  const [fallbackResult, setFallbackResult] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const usedStrategy = finalStatus === "fallback_success" ? "fallback" : finalStatus === "failed" ? "none" : "primary";

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setRetryStatus("idle");
    setCurrentAttempt(0);
    setAttempts([]);
    setErrors([]);
    setRetryEvents([]);
    setPrimaryResult("");
    setFallbackResult("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (typeof values.retry_status === "string") setRetryStatus(values.retry_status);
    if (typeof values.current_attempt === "number") setCurrentAttempt(values.current_attempt);
    if (Array.isArray(values.attempts)) setAttempts(normalizeAttempts(values.attempts));
    if (Array.isArray(values.errors)) setErrors(normalizeErrors(values.errors));
    if (Array.isArray(values.retry_events)) {
      setRetryEvents((current) => mergeRetryEvents(current, normalizeRetryEvents(values.retry_events)));
    }
    if (typeof values.primary_result === "string") setPrimaryResult(values.primary_result);
    if (typeof values.fallback_result === "string") setFallbackResult(values.fallback_result);
    if (typeof values.final === "string") setFinal(values.final);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "retry_status") return;
    const event = normalizeRetryEvents([data])[0];
    setRetryEvents((current) => mergeRetryEvents(current, [event]));
    setRetryStatus(event.status);
    setCurrentAttempt(event.attempt);
  }

  async function runRetryDemo(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setFinalStatus("running");
    setRetryStatus("prepared");
    setCurrentAttempt(0);
    setAttempts([]);
    setErrors([]);
    setRetryEvents([]);
    setPrimaryResult("");
    setFallbackResult("");
    setFinal("");
    setFinalState(null);
    setStatus("Creating retry thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "18-retry-error-degradation-ui", failureMode },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming retry demo");
      const stream = await client.runs.stream(nextThreadId, "18_retry_error_degradation", {
        input: {
          query: trimmed,
          failure_mode: failureMode,
          max_attempts: maxAttempts,
          fallback_enabled: fallbackEnabled && failureMode !== "final_failure",
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

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      applyValues(values);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="retry-layout">
      <aside className="retry-control">
        <div className="panel-title">
          <TimerReset aria-hidden="true" size={18} />
          Retry Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="sample-list" aria-label="Retry query samples">
          {samples.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="sample-button"
              onClick={() => setQuery(sample.value)}
              disabled={busy}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <div className="mode-picker" role="radiogroup" aria-label="Failure mode">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={failureMode === mode.value}
              className={failureMode === mode.value ? "mode-option active" : "mode-option"}
              onClick={() => {
                setFailureMode(mode.value);
                setFallbackEnabled(mode.value !== "final_failure");
              }}
              disabled={busy}
            >
              <strong>{mode.label}</strong>
              <span>{mode.detail}</span>
            </button>
          ))}
        </div>
        <form onSubmit={runRetryDemo} className="run-form">
          <label className="field">
            <span>Query</span>
            <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={5} />
          </label>
          <label className="field">
            <span>Max attempts</span>
            <input
              aria-label="Max attempts"
              type="number"
              min={1}
              max={4}
              value={maxAttempts}
              onChange={(event) => setMaxAttempts(Number(event.target.value))}
              disabled={busy}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={fallbackEnabled && failureMode !== "final_failure"}
              onChange={(event) => setFallbackEnabled(event.target.checked)}
              disabled={busy || failureMode === "final_failure"}
            />
            <span>Enable fallback</span>
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !query.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run retry demo
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
            <span>Attempts</span>
            <strong>{attempts.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`retry-status-panel ${finalStatus}`} role="region" aria-label="Run Status">
        <div className="panel-title">
          <ShieldCheck aria-hidden="true" size={18} />
          Run Status
        </div>
        <div className="retry-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Retry Status</span>
            <strong>{retryStatus}</strong>
          </div>
          <div>
            <span>Used Strategy</span>
            <strong>{usedStrategy}</strong>
          </div>
          <div>
            <span>Current Attempt</span>
            <strong>{currentAttempt || "none"}</strong>
          </div>
        </div>
      </div>

      <div className="retry-timeline-panel" role="region" aria-label="Retry Timeline">
        <div className="panel-title">Retry Timeline</div>
        <div className="retry-attempt-grid">
          {attempts.length === 0 ? (
            <p className="muted">Run a mode to see attempts and backoff.</p>
          ) : (
            attempts.map((attempt) => (
              <article key={`${attempt.attempt}-${attempt.status}`} className={`retry-attempt-card ${attempt.status}`}>
                <div className="retry-attempt-header">
                  <strong>Attempt {attempt.attempt}</strong>
                  <span>{attempt.status}</span>
                </div>
                {attempt.errorType ? <code>{attempt.errorType}</code> : null}
                {attempt.message ? <p>{attempt.message}</p> : null}
                {attempt.backoffMs ? <p><strong>Backoff:</strong> {attempt.backoffMs}ms</p> : null}
                {attempt.result ? <p>{attempt.result}</p> : null}
              </article>
            ))
          )}
        </div>
      </div>

      <div className="error-details-panel" role="region" aria-label="Error Details">
        <div className="panel-title">
          <AlertTriangle aria-hidden="true" size={18} />
          Error Details
        </div>
        <div className="error-record-list">
          {errors.length === 0 ? (
            <p className="muted">No structured errors yet.</p>
          ) : (
            errors.map((item) => (
              <article key={`${item.node}-${item.attempt}`} className={item.recoverable ? "recoverable" : "permanent"}>
                <strong>{item.errorType} attempt {item.attempt}</strong>
                <span>{item.recoverable ? "recoverable" : "not recoverable"}</span>
                <p>{item.message}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="fallback-result-panel" role="region" aria-label="Fallback Result">
        <div className="panel-title">
          <GitBranch aria-hidden="true" size={18} />
          Fallback Result
        </div>
        {fallbackResult ? (
          <div className="answer-box">{fallbackResult}</div>
        ) : primaryResult ? (
          <div className="answer-box">{primaryResult}</div>
        ) : (
          <p className="muted">Primary or fallback result will appear here.</p>
        )}
      </div>

      <div className="retry-events-panel" role="region" aria-label="Retry Events">
        <div className="panel-title">Retry Events</div>
        <div className="retry-event-list">
          {retryEvents.length === 0 ? (
            <p className="muted">Custom retry events will appear here.</p>
          ) : (
            retryEvents.map((event, index) => (
              <div key={`${event.phase}-${event.attempt}-${event.status}-${index}`} className={`retry-event ${event.status}`}>
                <strong>{event.phase}</strong>
                <span>attempt {event.attempt}</span>
                <code>{event.status}</code>
                <p>{event.detail}</p>
                {event.backoffMs ? <small>backoff {event.backoffMs}ms</small> : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box">{final || "No final answer yet."}</div>
      </div>

      <div className="state-panel retry-final-state" role="region" aria-label="Final State">
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
