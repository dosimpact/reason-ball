import { Check, Loader2, RotateCcw, ShieldAlert, SquarePen, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();
const storageKey = "langgraph-sdk-example-06-pending-thread";
const defaultAction = "delete production database backup after summarizing risk";
const editedAction = "archive production database backup after summarizing risk";

type InterruptPayload = {
  kind?: string;
  question?: string;
  action?: string;
  risk?: string;
  risk_summary?: string;
  options?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractInterruptPayload(value: unknown): InterruptPayload | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractInterruptPayload(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  if (isRecord(value.value) && value.value.kind === "approval_request") {
    return value.value as InterruptPayload;
  }
  if (value.kind === "approval_request") {
    return value as InterruptPayload;
  }

  const interrupts = value.interrupts;
  if (Array.isArray(interrupts)) return extractInterruptPayload(interrupts);
  const tasks = value.tasks;
  if (Array.isArray(tasks)) return extractInterruptPayload(tasks);

  for (const child of Object.values(value)) {
    const found = extractInterruptPayload(child);
    if (found) return found;
  }
  return null;
}

function valuesOf(state: unknown): Record<string, unknown> {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function readPendingThread(): string {
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function writePendingThread(threadId: string) {
  try {
    window.localStorage.setItem(storageKey, threadId);
  } catch {
    // localStorage is unavailable in some embedded browsers.
  }
}

function clearPendingThread() {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // localStorage is unavailable in some embedded browsers.
  }
}

export function HumanInTheLoopInterruptExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [action, setAction] = useState(defaultAction);
  const [editText, setEditText] = useState(editedAction);
  const [threadId, setThreadId] = useState("");
  const [pendingThreadId, setPendingThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [interruptPayload, setInterruptPayload] = useState<InterruptPayload | null>(null);
  const [finalState, setFinalState] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);

  useEffect(() => {
    const storedThreadId = readPendingThread();
    setPendingThreadId(storedThreadId);
    if (storedThreadId) {
      void recoverPendingInterrupt(storedThreadId);
    }
  }, []);

  function resetView() {
    clearPendingThread();
    setPendingThreadId("");
    setThreadId("");
    setStatus("Idle");
    setInterruptPayload(null);
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  async function refreshInterruptState(activeThreadId: string) {
    const state = await client.threads.getState(activeThreadId);
    const payload = extractInterruptPayload(state);
    const values = valuesOf(state);
    setFinalState(values);

    if (payload) {
      setInterruptPayload(payload);
      setStatus("Interrupted");
      writePendingThread(activeThreadId);
      setPendingThreadId(activeThreadId);
      return true;
    }

    setInterruptPayload(null);
    if (values.execution_result || values.final) {
      setStatus("Run complete");
      clearPendingThread();
      setPendingThreadId("");
    }
    return false;
  }

  async function startRun(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = action.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setInterruptPayload(null);
    setFinalState(null);
    setStatus("Creating approval thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "06-human-in-the-loop-interrupt-ui" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      writePendingThread(nextThreadId);
      setPendingThreadId(nextThreadId);
      setStatus("Running until approval interrupt");

      const stream = await client.runs.stream(nextThreadId, "human_in_the_loop_interrupt", {
        input: { action: trimmed },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 80));
        const maybeInterrupt = extractInterruptPayload(logEntry.data);
        if (maybeInterrupt) setInterruptPayload(maybeInterrupt);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const interrupted = await refreshInterruptState(nextThreadId);
      if (!interrupted) setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function recoverPendingInterrupt(overrideThreadId?: string) {
    const storedThreadId = overrideThreadId || pendingThreadId || readPendingThread();
    if (!storedThreadId) return;
    setBusy(true);
    setError("");
    setThreadId(storedThreadId);
    setStatus("Recovering pending interrupt");
    try {
      const interrupted = await refreshInterruptState(storedThreadId);
      if (!interrupted) setStatus("No pending interrupt");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Recovery failed");
    } finally {
      setBusy(false);
    }
  }

  async function resumeRun(resumeValue: unknown) {
    if (!threadId) return;
    setBusy(true);
    setError("");
    setStatus("Resuming approval run");

    try {
      const stream = await client.runs.stream(threadId, "human_in_the_loop_interrupt", {
        input: null,
        command: { resume: resumeValue },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 80));
        setStatus(`Streaming: ${logEntry.event}`);
      }

      await refreshInterruptState(threadId);
      setStatus("Run complete");
      setInterruptPayload(null);
      clearPendingThread();
      setPendingThreadId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Resume failed");
    } finally {
      setBusy(false);
    }
  }

  const resultText = String(finalState?.final ?? finalState?.execution_result ?? "");

  return (
    <section className="interrupt-layout">
      <aside className="interrupt-control">
        <div className="panel-title">
          <ShieldAlert aria-hidden="true" size={18} />
          Approval Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>

        <form onSubmit={startRun} className="run-form">
          <label className="field">
            <span>Action</span>
            <textarea value={action} onChange={(event) => setAction(event.target.value)} rows={4} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !action.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <ShieldAlert size={16} />}
              Start approval run
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
            <span>Pending Thread</span>
            <strong>{pendingThreadId || "none"}</strong>
          </div>
        </div>

        {pendingThreadId ? (
          <button
            type="button"
            className="secondary-button full-width-button"
            onClick={() => void recoverPendingInterrupt()}
            disabled={busy}
          >
            Recover pending interrupt
          </button>
        ) : null}

        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className="interrupt-panel" role="region" aria-label="Interrupt approval payload">
        <div className="panel-title">Interrupt Approval Payload</div>
        {interruptPayload ? (
          <div className="approval-card">
            <div className="approval-header">
              <strong>{interruptPayload.question ?? "Approval required"}</strong>
              <span>{interruptPayload.risk ?? "unknown"} risk</span>
            </div>
            <dl className="approval-details">
              <div>
                <dt>Action</dt>
                <dd>{interruptPayload.action}</dd>
              </div>
              <div>
                <dt>Risk Summary</dt>
                <dd>{interruptPayload.risk_summary}</dd>
              </div>
            </dl>
            <label className="field">
              <span>Edited Action</span>
              <textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                rows={3}
              />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                onClick={() => void resumeRun("approve")}
                disabled={busy}
              >
                <Check size={16} />
                Approve
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void resumeRun({ action: "edit", action_text: editText })}
                disabled={busy || !editText.trim()}
              >
                <SquarePen size={16} />
                Approve edited action
              </button>
              <button
                type="button"
                className="secondary-button danger"
                onClick={() => void resumeRun("reject")}
                disabled={busy}
              >
                <X size={16} />
                Reject
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">Start a high-risk action to pause at an approval interrupt.</p>
        )}
      </div>

      <div className="state-panel interrupt-state" role="region" aria-label="Final State">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? JSON.stringify(finalState, null, 2) : "No state yet."}</pre>
      </div>

      <div className="result-panel interrupt-result" role="region" aria-label="Decision Result">
        <div className="panel-title">Decision Result</div>
        <div className="answer-box">{resultText || "No decision result yet."}</div>
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
                  <strong>{entry.event}</strong>
                </summary>
                <pre>{JSON.stringify(entry.data, null, 2)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
