import { Brain, CheckCircle2, Loader2, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createClientId,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";


const analysisPrompt =
  "Explain how a LangGraph UI can show useful public reasoning status without exposing non-public model notes.";
const supportPrompt =
  "Summarize how a support ticket triage graph should show visible thinking status before the final answer.";

type JsonRecord = Record<string, unknown>;

type ThinkingStep = {
  type: string;
  schemaVersion: string;
  stepId: string;
  sequence: number;
  label: string;
  status: string;
  publicSummary: string;
  detail: string;
  timestamp: string;
  publicOnly: boolean;
};

type SafetyGuardrails = {
  publicOnly: boolean;
  hiddenReasoningExposed: boolean;
  policy: string;
  allowedContent: string[];
  blockedContent: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

const sensitiveKeyPattern = /(chain[_ -]?of[_ -]?thought|raw[_ -]?reasoning|reasoning[_ -]?trace|thoughts|private[_ -]?)/i;

function sanitizeForDisplay(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForDisplay);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, childValue]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[redacted: non-public field]" : sanitizeForDisplay(childValue),
    ]),
  );
}

function formatJson(value: unknown) {
  return JSON.stringify(sanitizeForDisplay(value), null, 2);
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function normalizeThinkingStep(value: unknown): ThinkingStep | null {
  if (!isRecord(value)) return null;
  if (value.type !== "thinking_renderer" && typeof value.step_id !== "string") return null;
  return {
    type: typeof value.type === "string" ? value.type : "thinking_renderer",
    schemaVersion: typeof value.schema_version === "string" ? value.schema_version : "v1",
    stepId: typeof value.step_id === "string" ? value.step_id : createClientId("step"),
    sequence: typeof value.sequence === "number" ? value.sequence : 0,
    label: typeof value.label === "string" ? value.label : "Thinking step",
    status: typeof value.status === "string" ? value.status : "",
    publicSummary: typeof value.public_summary === "string" ? value.public_summary : "",
    detail: typeof value.detail === "string" ? value.detail : "",
    timestamp: typeof value.timestamp === "string" ? value.timestamp : "",
    publicOnly: typeof value.public_only === "boolean" ? value.public_only : true,
  };
}

function normalizeThinkingSteps(value: unknown): ThinkingStep[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeThinkingStep).filter((step): step is ThinkingStep => step !== null);
}

function normalizeGuardrails(value: unknown): SafetyGuardrails | null {
  if (!isRecord(value)) return null;
  return {
    publicOnly: typeof value.public_only === "boolean" ? value.public_only : true,
    hiddenReasoningExposed:
      typeof value.hidden_reasoning_exposed === "boolean" ? value.hidden_reasoning_exposed : false,
    policy: typeof value.policy === "string" ? value.policy : "",
    allowedContent: Array.isArray(value.allowed_content) ? value.allowed_content.map(String) : [],
    blockedContent: Array.isArray(value.blocked_content) ? value.blocked_content.map(String) : [],
  };
}

function mergeThinkingSteps(current: ThinkingStep[], next: ThinkingStep[]) {
  const byKey = new Map<string, ThinkingStep>();
  [...current, ...next].forEach((step) => {
    byKey.set(`${step.stepId}:${step.sequence}`, step);
  });
  return [...byKey.values()].sort((left, right) => left.sequence - right.sequence).slice(-80);
}

export function ThinkingRendererExample() {
  const [question, setQuestion] = useState(analysisPrompt);
  const [threadId, setThreadId] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [reasoningSummary, setReasoningSummary] = useState("");
  const [safetyGuardrails, setSafetyGuardrails] = useState<SafetyGuardrails | null>(null);
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const completedSteps = thinkingSteps.filter((step) => step.status === "completed").length;

  function resetView() {
    setThreadId("");
    setRunId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setThinkingSteps([]);
    setReasoningSummary("");
    setSafetyGuardrails(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyThinkingSteps(next: ThinkingStep[]) {
    setThinkingSteps((current) => mergeThinkingSteps(current, next));
  }

  function applyValues(values: JsonRecord) {
    if (typeof values.run_id === "string") setRunId(values.run_id);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Array.isArray(values.thinking_steps)) applyThinkingSteps(normalizeThinkingSteps(values.thinking_steps));
    if (typeof values.reasoning_summary === "string") setReasoningSummary(values.reasoning_summary);
    if (isRecord(values.safety_guardrails)) setSafetyGuardrails(normalizeGuardrails(values.safety_guardrails));
    if (typeof values.answer === "string") setAnswer(values.answer);
    if (typeof values.final === "string") setFinal(values.final);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    const step = normalizeThinkingStep(data);
    if (step) applyThinkingSteps([step]);
  }

  async function runThinkingRenderer(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setThinkingSteps([]);
    setReasoningSummary("");
    setSafetyGuardrails(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setFinalStatus("running");
    setStatus("Creating thinking thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "23-thinking-renderer" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming thinking status");
      const stream = await client.runs.stream(nextThreadId, "23_thinking_renderer", {
        input: { question: trimmed },
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
    <section className="thinking-layout">
      <aside className="thinking-control">
        <div className="panel-title">
          <Brain aria-hidden="true" size={18} />
          Thinking Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => setQuestion(analysisPrompt)} disabled={busy}>
            <Brain size={16} />
            Use analysis sample
          </button>
          <button type="button" className="secondary-button" onClick={() => setQuestion(supportPrompt)} disabled={busy}>
            <CheckCircle2 size={16} />
            Use support sample
          </button>
        </div>
        <form className="run-form" onSubmit={runThinkingRenderer}>
          <label className="field">
            <span>Thinking prompt</span>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={6} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !question.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run thinking renderer
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

      <div className={`thinking-status-panel ${finalStatus}`} role="region" aria-label="Thinking Status">
        <div className="panel-title">Thinking Status</div>
        <div className="thinking-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Public Steps</span>
            <strong>{thinkingSteps.length}</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>{completedSteps}</strong>
          </div>
          <div>
            <span>Public Only</span>
            <strong>{safetyGuardrails?.publicOnly ? "yes" : "pending"}</strong>
          </div>
        </div>
      </div>

      <div className="thinking-timeline-panel" role="region" aria-label="Thinking Timeline">
        <div className="panel-title">Thinking Timeline</div>
        <div className="thinking-step-list">
          {thinkingSteps.length === 0 ? (
            <p className="muted">Public thinking status blocks appear while the graph runs.</p>
          ) : (
            thinkingSteps.map((step) => (
              <details key={`${step.stepId}-${step.sequence}`} className={`thinking-step ${step.status}`} open>
                <summary>
                  <strong>{step.label}</strong>
                  <span>{step.status}</span>
                </summary>
                <p>{step.publicSummary}</p>
                <small>{step.detail}</small>
                <code>{step.publicOnly ? "public_only" : "not_public"}</code>
              </details>
            ))
          )}
        </div>
      </div>

      <div className="reasoning-summary-panel" role="region" aria-label="Public Reasoning Summary">
        <div className="panel-title">Public Reasoning Summary</div>
        <div className="answer-box compact-answer">
          {reasoningSummary || "Public summary appears after the graph builds visible status notes."}
        </div>
      </div>

      <div className="guardrails-panel" role="region" aria-label="Safety Guardrails">
        <div className="panel-title">
          <ShieldCheck aria-hidden="true" size={18} />
          Safety Guardrails
        </div>
        {safetyGuardrails ? (
          <div className="guardrail-card">
            <strong>{safetyGuardrails.policy}</strong>
            <dl>
              <div>
                <dt>Public only</dt>
                <dd>{safetyGuardrails.publicOnly ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Non-public notes exposed</dt>
                <dd>{safetyGuardrails.hiddenReasoningExposed ? "yes" : "no"}</dd>
              </div>
            </dl>
            <p>Allowed: {safetyGuardrails.allowedContent.join(", ")}</p>
            <p>Blocked: {safetyGuardrails.blockedContent.join(", ")}</p>
          </div>
        ) : (
          <p className="muted">Guardrails are loaded at run start.</p>
        )}
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box compact-answer">{final || answer || "No final answer yet."}</div>
      </div>

      <div className="state-panel thinking-final-state" role="region" aria-label="Final State">
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
