import {
  CheckCircle2,
  ClipboardCheck,
  GitCompareArrows,
  Loader2,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();

const samples = [
  {
    label: "Checkpoint Update",
    value:
      "Draft a concise product update for developers explaining why LangGraph checkpointing helps with review, replay, and safer agent releases.",
  },
  {
    label: "Interrupt Release",
    value:
      "Write a short launch note for engineering teams explaining when to use human approval interrupts in an agent workflow.",
  },
  {
    label: "Streaming Guide",
    value:
      "Create a practical developer blurb about using LangGraph stream modes to debug node updates and custom progress events.",
  },
];

const retryPolicies = [
  {
    label: "Force first retry",
    value: "force_first_retry",
    detail: "guarantees a visible rewrite loop",
  },
  {
    label: "Allow immediate pass",
    value: "allow_pass",
    detail: "trust the first evaluator verdict",
  },
] as const;

type RetryPolicy = (typeof retryPolicies)[number]["value"];
type JsonRecord = Record<string, unknown>;
type Verdict = "PASS" | "FAIL" | "";

type IterationRecord = {
  iteration: number;
  draft: string;
  critique: string;
  verdict: Verdict;
  score: number;
  feedback: string;
  strengths: string[];
  requiredChanges: string[];
  status: string;
};

type LoopEvent = {
  type: string;
  iteration: number;
  phase: string;
  verdict: string;
  score: number;
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

function normalizeVerdict(value: unknown): Verdict {
  if (value === "PASS" || value === "FAIL") return value;
  return "";
}

function normalizeIterations(value: unknown): IterationRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((iteration, index) => ({
    iteration: typeof iteration.iteration === "number" ? iteration.iteration : index + 1,
    draft: typeof iteration.draft === "string" ? iteration.draft : "",
    critique: typeof iteration.critique === "string" ? iteration.critique : "",
    verdict: normalizeVerdict(iteration.verdict),
    score: typeof iteration.score === "number" ? iteration.score : 0,
    feedback: typeof iteration.feedback === "string" ? iteration.feedback : "",
    strengths: normalizeStringList(iteration.strengths),
    requiredChanges: normalizeStringList(iteration.required_changes ?? iteration.requiredChanges),
    status: typeof iteration.status === "string" ? iteration.status : "pending",
  }));
}

function normalizeLoopEvents(value: unknown): LoopEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event, index) => ({
    type: typeof event.type === "string" ? event.type : "reflection_iteration",
    iteration: typeof event.iteration === "number" ? event.iteration : index + 1,
    phase: typeof event.phase === "string" ? event.phase : "event",
    verdict: typeof event.verdict === "string" ? event.verdict : "",
    score: typeof event.score === "number" ? event.score : 0,
    detail: typeof event.detail === "string" ? event.detail : "",
  }));
}

export function ReflectionEvaluatorLoopExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [request, setRequest] = useState(samples[0].value);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [retryPolicy, setRetryPolicy] = useState<RetryPolicy>("force_first_retry");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [loopStatus, setLoopStatus] = useState("idle");
  const [currentIteration, setCurrentIteration] = useState(0);
  const [iterations, setIterations] = useState<IterationRecord[]>([]);
  const [loopEvents, setLoopEvents] = useState<LoopEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [requiredChanges, setRequiredChanges] = useState<string[]>([]);
  const [stopReason, setStopReason] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
  const rejectedIterations = useMemo(
    () => iterations.filter((iteration) => iteration.verdict === "FAIL"),
    [iterations],
  );
  const acceptedIteration = useMemo(
    () => iterations.find((iteration) => iteration.verdict === "PASS") ?? iterations.at(-1),
    [iterations],
  );

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setLoopStatus("idle");
    setCurrentIteration(0);
    setIterations([]);
    setLoopEvents([]);
    setDraft("");
    setVerdict("");
    setScore(0);
    setFeedback("");
    setRequiredChanges([]);
    setStopReason("");
    setFinalAnswer("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (typeof values.loop_status === "string") {
      setLoopStatus(values.loop_status);
    }
    if (typeof values.current_iteration === "number") {
      setCurrentIteration(values.current_iteration);
    }
    if (Array.isArray(values.iterations)) {
      setIterations(normalizeIterations(values.iterations));
    }
    if (Array.isArray(values.loop_events)) {
      setLoopEvents(normalizeLoopEvents(values.loop_events));
    }
    if (typeof values.draft === "string") {
      setDraft(values.draft);
    }
    if (values.verdict === "PASS" || values.verdict === "FAIL") {
      setVerdict(values.verdict);
    }
    if (typeof values.score === "number") {
      setScore(values.score);
    }
    if (typeof values.feedback === "string") {
      setFeedback(values.feedback);
    }
    if (Array.isArray(values.required_changes)) {
      setRequiredChanges(normalizeStringList(values.required_changes));
    }
    if (typeof values.stop_reason === "string") {
      setStopReason(values.stop_reason);
    }
    if (typeof values.final_answer === "string") {
      setFinalAnswer(values.final_answer);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "reflection_iteration") return;
    const event = normalizeLoopEvents([data])[0];
    setLoopEvents((current) => [event, ...current].slice(0, 50));
    if (event.phase) {
      setLoopStatus(event.phase);
    }
    if (event.iteration) {
      setCurrentIteration(event.iteration);
    }
  }

  async function runLoop(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = request.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setLoopStatus("idle");
    setCurrentIteration(0);
    setIterations([]);
    setLoopEvents([]);
    setDraft("");
    setVerdict("");
    setScore(0);
    setFeedback("");
    setRequiredChanges([]);
    setStopReason("");
    setFinalAnswer("");
    setFinalState(null);
    setStatus("Creating reflection thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "15-reflection-evaluator-loop-ui", retryPolicy },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming reflection loop");

      const stream = await client.runs.stream(nextThreadId, "reflection_evaluator_loop", {
        input: {
          request: trimmed,
          max_attempts: maxAttempts,
          retry_policy: retryPolicy,
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
    <section className="reflection-layout">
      <aside className="reflection-control">
        <div className="panel-title">
          <ClipboardCheck aria-hidden="true" size={18} />
          Reflection Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="sample-list" aria-label="Reflection request samples">
          {samples.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="sample-button"
              onClick={() => setRequest(sample.value)}
              disabled={busy}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <div className="mode-picker" role="radiogroup" aria-label="Retry policy">
          {retryPolicies.map((policy) => (
            <button
              key={policy.value}
              type="button"
              role="radio"
              aria-checked={retryPolicy === policy.value}
              className={retryPolicy === policy.value ? "mode-option active" : "mode-option"}
              onClick={() => setRetryPolicy(policy.value)}
              disabled={busy}
            >
              <strong>{policy.label}</strong>
              <span>{policy.detail}</span>
            </button>
          ))}
        </div>
        <form onSubmit={runLoop} className="run-form">
          <label className="field">
            <span>Request</span>
            <textarea value={request} onChange={(event) => setRequest(event.target.value)} rows={6} />
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
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !request.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run reflection loop
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
            <span>Iterations</span>
            <strong>{iterations.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`loop-status-panel ${loopStatus}`} role="region" aria-label="Loop Status">
        <div className="panel-title">
          <CheckCircle2 aria-hidden="true" size={18} />
          Loop Status
        </div>
        <div className="loop-status-grid">
          <div>
            <span>Loop</span>
            <strong>{loopStatus}</strong>
          </div>
          <div>
            <span>Current Iteration</span>
            <strong>{currentIteration || "none"}</strong>
          </div>
          <div>
            <span>Max Attempts</span>
            <strong>{maxAttempts}</strong>
          </div>
          <div>
            <span>Verdict</span>
            <strong>{verdict || "pending"}</strong>
          </div>
          <div>
            <span>Score</span>
            <strong>{score ? `${score}/5` : "pending"}</strong>
          </div>
        </div>
        {stopReason ? <p className="final-line">{stopReason}</p> : null}
      </div>

      <div className="evaluator-panel" role="region" aria-label="Evaluator Feedback">
        <div className="panel-title">Evaluator Feedback</div>
        <div className="feedback-card">
          <span>{verdict || "pending"}</span>
          <strong>{score ? `Score ${score}/5` : "No score yet"}</strong>
          <p>{feedback || "Run the loop to see evaluator feedback."}</p>
        </div>
        {requiredChanges.length > 0 ? (
          <ul className="required-change-list">
            {requiredChanges.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="iteration-history-panel" role="region" aria-label="Iteration History">
        <div className="panel-title">Iteration History</div>
        <div className="iteration-card-grid">
          {iterations.length === 0 ? (
            <p className="muted">Iteration cards will appear after the evaluator runs.</p>
          ) : (
            iterations.map((iteration) => (
              <article
                key={iteration.iteration}
                className={`iteration-card ${iteration.verdict.toLowerCase() || "pending"}`}
              >
                <div className="iteration-card-header">
                  <strong>Attempt {iteration.iteration}</strong>
                  <span>Verdict {iteration.verdict || "pending"}</span>
                </div>
                <strong>Score {iteration.score || 0}/5</strong>
                <div className="score-meter" aria-label={`Score ${iteration.score} out of 5`}>
                  <div style={{ width: `${Math.max(iteration.score, 0) * 20}%` }} />
                </div>
                <p><strong>Draft:</strong> {iteration.draft}</p>
                <p>{iteration.feedback}</p>
                {iteration.requiredChanges.length > 0 ? (
                  <ul>
                    {iteration.requiredChanges.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>

      <div className="draft-comparison-panel" role="region" aria-label="Draft Comparison">
        <div className="panel-title">
          <GitCompareArrows aria-hidden="true" size={18} />
          Draft Comparison
        </div>
        <div className="draft-comparison-grid">
          <section>
            <h3>Rejected Drafts</h3>
            {rejectedIterations.length === 0 ? (
              <p className="muted">Rejected drafts remain visible here after a retry.</p>
            ) : (
              rejectedIterations.map((iteration) => (
                <article key={iteration.iteration} className="draft-card rejected">
                  <strong>Attempt {iteration.iteration} rejected</strong>
                  <p>{iteration.draft}</p>
                  <code>{iteration.critique}</code>
                </article>
              ))
            )}
          </section>
          <section>
            <h3>Latest Accepted Draft</h3>
            {acceptedIteration ? (
              <article className={`draft-card ${acceptedIteration.verdict.toLowerCase() || "latest"}`}>
                <strong>Attempt {acceptedIteration.iteration} {acceptedIteration.verdict || "latest"}</strong>
                <p>{acceptedIteration.draft || draft}</p>
              </article>
            ) : (
              <p className="muted">{draft || "No draft yet."}</p>
            )}
          </section>
        </div>
      </div>

      <div className="loop-events-panel" role="region" aria-label="Loop Events">
        <div className="panel-title">Loop Events</div>
        <div className="loop-event-list">
          {loopEvents.length === 0 ? (
            <p className="muted">Custom progress events will appear here.</p>
          ) : (
            loopEvents.slice(0, 14).map((event, index) => (
              <div key={`${event.iteration}-${event.phase}-${index}`} className={`loop-event ${event.phase}`}>
                <Square aria-hidden="true" size={12} />
                <strong>{event.phase}</strong>
                <span>attempt {event.iteration}</span>
                {event.verdict ? <span>{event.verdict} {event.score ? `${event.score}/5` : ""}</span> : null}
                <p>{event.detail}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box">{finalAnswer || "No final answer yet."}</div>
      </div>

      <div className="state-panel reflection-final-state" role="region" aria-label="Final State">
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
