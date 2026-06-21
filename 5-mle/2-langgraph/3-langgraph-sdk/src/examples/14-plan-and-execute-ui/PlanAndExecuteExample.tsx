import { CheckSquare, GitBranch, Loader2, Play, RotateCcw, Route, Square } from "lucide-react";
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
    label: "SDK Demo",
    value: "Build a LangGraph SDK learning demo: plan the work, implement the UI, and verify it.",
  },
  {
    label: "Blog Post",
    value: "Write a blog post about RAG: outline the post, draft the key sections, and prepare an edit checklist.",
  },
  {
    label: "Launch Checklist",
    value: "Prepare a launch checklist for a developer preview: define scope, coordinate teams, and verify release readiness.",
  },
];

const modes = [
  {
    label: "Normal",
    value: "normal",
    detail: "execute every planned step",
  },
  {
    label: "Replan",
    value: "replan_after_first",
    detail: "revise remaining steps after step one",
  },
  {
    label: "Stop",
    value: "stop_after_first",
    detail: "stop after the first completed step",
  },
] as const;

type ControlMode = (typeof modes)[number]["value"];
type StepStatus = "pending" | "active" | "completed" | "failed" | "skipped" | "replanned";
type JsonRecord = Record<string, unknown>;

type PlanStep = {
  id: string;
  index: number;
  title: string;
  status: StepStatus;
  result: string;
  error: string;
  source: string;
};

type StepEvent = {
  type: string;
  stepId: string;
  status: StepStatus;
  title: string;
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

function normalizeStatus(value: unknown): StepStatus {
  if (
    value === "pending" ||
    value === "active" ||
    value === "completed" ||
    value === "failed" ||
    value === "skipped" ||
    value === "replanned"
  ) {
    return value;
  }
  return "pending";
}

function normalizeSteps(value: unknown): PlanStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((step, index) => ({
    id: typeof step.id === "string" ? step.id : `step-${index + 1}`,
    index: typeof step.index === "number" ? step.index : index + 1,
    title: typeof step.title === "string" ? step.title : `Step ${index + 1}`,
    status: normalizeStatus(step.status),
    result: typeof step.result === "string" ? step.result : "",
    error: typeof step.error === "string" ? step.error : "",
    source: typeof step.source === "string" ? step.source : "planner",
  }));
}

function normalizeEvents(value: unknown): StepEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event, index) => ({
    type: typeof event.type === "string" ? event.type : "plan_step",
    stepId: typeof event.step_id === "string" ? event.step_id : String(event.stepId ?? `event-${index + 1}`),
    status: normalizeStatus(event.status),
    title: typeof event.title === "string" ? event.title : `Step ${index + 1}`,
    detail: typeof event.detail === "string" ? event.detail : "",
  }));
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function updateStepFromEvent(steps: PlanStep[], event: StepEvent) {
  return steps.map((step) =>
    step.id === event.stepId
      ? {
          ...step,
          status: event.status,
          result: event.status === "completed" ? event.detail || step.result : step.result,
          error: event.status === "failed" ? event.detail || step.error : step.error,
        }
      : step,
  );
}

export function PlanAndExecuteExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [task, setTask] = useState(samples[0].value);
  const [controlMode, setControlMode] = useState<ControlMode>("normal");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [executionStatus, setExecutionStatus] = useState("idle");
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const [completedSteps, setCompletedSteps] = useState<PlanStep[]>([]);
  const [stepEvents, setStepEvents] = useState<StepEvent[]>([]);
  const [planVersion, setPlanVersion] = useState(0);
  const [replanned, setReplanned] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
  const activeStep = useMemo(() => planSteps.find((step) => step.status === "active"), [planSteps]);

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setExecutionStatus("idle");
    setPlanSteps([]);
    setCompletedSteps([]);
    setStepEvents([]);
    setPlanVersion(0);
    setReplanned(false);
    setStopped(false);
    setStopReason("");
    setFinalAnswer("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (typeof values.execution_status === "string") {
      setExecutionStatus(values.execution_status);
    }
    if (Array.isArray(values.plan_steps)) {
      setPlanSteps(normalizeSteps(values.plan_steps));
    }
    if (Array.isArray(values.completed_steps)) {
      setCompletedSteps(normalizeSteps(values.completed_steps));
    }
    if (Array.isArray(values.step_events)) {
      setStepEvents(normalizeEvents(values.step_events));
    }
    if (typeof values.plan_version === "number") {
      setPlanVersion(values.plan_version);
    }
    if (typeof values.replanned === "boolean") {
      setReplanned(values.replanned);
    }
    if (typeof values.stopped === "boolean") {
      setStopped(values.stopped);
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
    if (!isRecord(data) || data.type !== "plan_step") return;
    const event = normalizeEvents([data])[0];
    setStepEvents((current) => [event, ...current].slice(0, 40));
    setPlanSteps((current) => updateStepFromEvent(current, event));
  }

  async function runPlan(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = task.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setExecutionStatus("idle");
    setPlanSteps([]);
    setCompletedSteps([]);
    setStepEvents([]);
    setPlanVersion(0);
    setReplanned(false);
    setStopped(false);
    setStopReason("");
    setFinalAnswer("");
    setFinalState(null);
    setStatus("Creating plan thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "14-plan-and-execute-ui", controlMode },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming plan execution");

      const stream = await client.runs.stream(nextThreadId, "plan_and_execute", {
        input: { task: trimmed, control_mode: controlMode },
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
    <section className="plan-execute-layout">
      <aside className="plan-execute-control">
        <div className="panel-title">
          <Route aria-hidden="true" size={18} />
          Plan Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="sample-list" aria-label="Plan task samples">
          {samples.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="sample-button"
              onClick={() => setTask(sample.value)}
              disabled={busy}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <div className="mode-picker" role="radiogroup" aria-label="Run mode">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={controlMode === mode.value}
              className={controlMode === mode.value ? "mode-option active" : "mode-option"}
              onClick={() => setControlMode(mode.value)}
              disabled={busy}
            >
              <strong>{mode.label}</strong>
              <span>{mode.detail}</span>
            </button>
          ))}
        </div>
        <form onSubmit={runPlan} className="run-form">
          <label className="field">
            <span>Task</span>
            <textarea value={task} onChange={(event) => setTask(event.target.value)} rows={6} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !task.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run plan
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
            <span>Steps</span>
            <strong>{planSteps.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`execution-status-panel ${executionStatus}`} role="region" aria-label="Execution Status">
        <div className="panel-title">
          <CheckSquare aria-hidden="true" size={18} />
          Execution Status
        </div>
        <div className="execution-status-grid">
          <div>
            <span>Execution</span>
            <strong>{executionStatus}</strong>
          </div>
          <div>
            <span>Active Step</span>
            <strong>{activeStep?.title || "none"}</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>{completedSteps.length}</strong>
          </div>
          <div>
            <span>Plan Version</span>
            <strong>{planVersion || "none"}</strong>
          </div>
        </div>
      </div>

      <div className="control-state-panel" role="region" aria-label="Replan / Stop Controls">
        <div className="panel-title">
          <GitBranch aria-hidden="true" size={18} />
          Replan / Stop Controls
        </div>
        <div className="control-state-grid">
          <div>
            <span>Control Mode</span>
            <strong>{controlMode}</strong>
          </div>
          <div>
            <span>Replanned</span>
            <strong>{replanned ? "yes" : "no"}</strong>
          </div>
          <div>
            <span>Stopped</span>
            <strong>{stopped ? "yes" : "no"}</strong>
          </div>
        </div>
        {stopReason ? <p className="fallback-line">{stopReason}</p> : null}
      </div>

      <div className="plan-steps-panel" role="region" aria-label="Plan Steps">
        <div className="panel-title">Plan Steps</div>
        <div className="plan-step-grid">
          {planSteps.length === 0 ? (
            <p className="muted">Run a task to see planner output.</p>
          ) : (
            planSteps.map((step) => (
              <article
                key={step.id}
                className={`plan-step-card ${step.status}`}
                data-step-id={step.id}
                data-status={step.status}
              >
                <div className="plan-step-header">
                  <strong>{step.index}. {step.title}</strong>
                  <span>{step.status}</span>
                </div>
                <code>{step.id} / {step.source}</code>
                {step.result ? <p><strong>Result:</strong> {step.result}</p> : null}
                {step.error ? <p><strong>Note:</strong> {step.error}</p> : null}
              </article>
            ))
          )}
        </div>
      </div>

      <div className="executor-output-panel" role="region" aria-label="Executor Output">
        <div className="panel-title">Executor Output</div>
        {completedSteps.length === 0 ? (
          <p className="muted">Completed step results will appear here.</p>
        ) : (
          <ol className="completed-step-list">
            {completedSteps.map((step) => (
              <li key={step.id}>
                <strong>{step.title}</strong>
                <span>{step.status}</span>
                <p>{step.result || step.error}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="step-events-panel" role="region" aria-label="Step Events">
        <div className="panel-title">Step Events</div>
        <div className="step-event-list">
          {stepEvents.length === 0 ? (
            <p className="muted">No step events yet.</p>
          ) : (
            stepEvents.slice(0, 12).map((event, index) => (
              <div key={`${event.stepId}-${event.status}-${index}`} className={`step-event ${event.status}`}>
                <Square aria-hidden="true" size={12} />
                <strong>{event.status}</strong>
                <span>{event.title}</span>
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

      <div className="state-panel plan-final-state" role="region" aria-label="Final State">
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
