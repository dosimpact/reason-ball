import { Check, Loader2, RotateCcw, ShieldAlert, SquarePen, X } from "lucide-react";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { langGraphApiUrl, StreamLogEntry, createClientId } from "../../lib/langgraphClient";

const defaultAction = "delete production database backup after summarizing risk";
const editedAction = "archive production database backup after summarizing risk";

type ApprovalState = {
  action?: string;
  proposed_action?: string;
  risk?: string;
  risk_summary?: string;
  approved?: boolean;
  decision?: string;
  edited_action?: string;
  execution_result?: string;
  final?: string;
  approval_payload?: InterruptPayload;
  __interrupt__?: Array<{ value?: InterruptPayload; id?: string }>;
};

type InterruptPayload = {
  kind?: string;
  question?: string;
  action?: string;
  risk?: string;
  risk_summary?: string;
  options?: string[];
};

function isInterruptPayload(value: unknown): value is InterruptPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).kind === "approval_request"
  );
}

function payloadFromInterrupt(value: unknown): InterruptPayload | null {
  if (Array.isArray(value)) return payloadFromInterrupt(value[0]);
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (isInterruptPayload(record.value)) return record.value;
  if (isInterruptPayload(value)) return value;
  return null;
}

export function HumanInTheLoopReactHookExample() {
  const [action, setAction] = useState(defaultAction);
  const [editText, setEditText] = useState(editedAction);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [status, setStatus] = useState("Idle");

  const addEvent = useCallback((event: string, data: unknown, runId?: string) => {
    setEvents((current) =>
      [
        {
          id: createClientId("stream"),
          event,
          runId,
          data,
          receivedAt: new Date().toLocaleTimeString(),
        },
        ...current,
      ].slice(0, 80),
    );
  }, []);

  const stream = useStream<ApprovalState>({
    apiUrl: langGraphApiUrl,
    assistantId: "06_human_in_the_loop_interrupt",
    threadId,
    onThreadId: setThreadId,
    onCreated(run) {
      setStatus("Run created");
      addEvent("created", run, run.run_id);
    },
    onMetadataEvent(data) {
      addEvent("metadata", data, data.run_id);
    },
    onUpdateEvent(data) {
      addEvent("updates", data);
    },
    onCustomEvent(data) {
      addEvent("custom", data);
    },
    onFinish(state, run) {
      addEvent("finish", state.values, run?.run_id);
      setStatus("Run complete");
    },
    onError(error, run) {
      addEvent("error", error, run?.run_id);
      setStatus("Run failed");
    },
  });

  const interruptPayload = useMemo(
    () => payloadFromInterrupt(stream.interrupt),
    [stream.interrupt],
  );
  const values = stream.values;
  const resultText = String(values.final ?? values.execution_result ?? "");
  const busy = stream.isLoading;

  async function startRun(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = action.trim();
    if (!trimmed) return;

    setEvents([]);
    setStatus("Running until approval interrupt");
    await stream.submit(
      { action: trimmed },
      {
        streamMode: ["updates"],
      },
    );
    if (stream.interrupt) setStatus("Interrupted");
  }

  async function resumeRun(resumeValue: unknown) {
    setStatus("Resuming approval run");
    await stream.submit(null, {
      command: { resume: resumeValue },
      streamMode: ["updates"],
    });
  }

  function resetView() {
    stream.switchThread(null);
    setThreadId(null);
    setEvents([]);
    setStatus("Idle");
  }

  return (
    <section className="interrupt-layout">
      <aside className="interrupt-control">
        <div className="panel-title">
          <ShieldAlert aria-hidden="true" size={18} />
          React Hook Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>

        <form onSubmit={startRun} className="run-form">
          <label className="field">
            <span>Action</span>
            <textarea value={action} onChange={(event) => setAction(event.target.value)} rows={4} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !action.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <ShieldAlert size={16} />}
              Start with useStream
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
            <strong>{interruptPayload ? "Interrupted" : status}</strong>
          </div>
          <div>
            <span>Thread ID</span>
            <strong>{threadId || "none"}</strong>
          </div>
          <div>
            <span>SDK surface</span>
            <strong>useStream.interrupt</strong>
          </div>
        </div>
      </aside>

      <div className="interrupt-panel" role="region" aria-label="React hook interrupt payload">
        <div className="panel-title">
          <ShieldAlert aria-hidden="true" size={18} />
          Interrupt Projection
        </div>

        {interruptPayload ? (
          <div className="approval-card">
            <div className="approval-card-header">
              <strong>{interruptPayload.question ?? "Approval required"}</strong>
              <span>{interruptPayload.risk ?? "unknown"} risk</span>
            </div>
            <dl>
              <dt>Action</dt>
              <dd>{interruptPayload.action}</dd>
              <dt>Risk summary</dt>
              <dd>{interruptPayload.risk_summary}</dd>
            </dl>
            <label className="field">
              <span>Edit action</span>
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
                disabled={busy}
                onClick={() => void resumeRun("approve")}
              >
                <Check size={16} />
                Approve
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy || !editText.trim()}
                onClick={() => void resumeRun({ action: "edit", action_text: editText.trim() })}
              >
                <SquarePen size={16} />
                Edit
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={busy}
                onClick={() => void resumeRun("reject")}
              >
                <X size={16} />
                Reject
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">Start a high-risk action to read the interrupt through useStream.</p>
        )}
      </div>

      <div className="event-panel" role="region" aria-label="React hook stream events">
        <div className="panel-title">
          <Loader2 aria-hidden="true" size={18} />
          Hook Callbacks
        </div>
        <div className="event-list">
          {events.map((event) => (
            <article key={event.id} className="event-item">
              <header>
                <strong>{event.event}</strong>
                <span>{event.receivedAt}</span>
              </header>
              <pre>{JSON.stringify(event.data, null, 2)}</pre>
            </article>
          ))}
          {events.length === 0 ? <p className="muted">No hook callback events yet.</p> : null}
        </div>
      </div>

      <div className="state-panel interrupt-state" role="region" aria-label="Hook final state">
        <div className="panel-title">State Values</div>
        <pre>{JSON.stringify(values, null, 2)}</pre>
      </div>

      <div className="result-panel interrupt-result" role="region" aria-label="Hook decision result">
        <div className="panel-title">Decision Result</div>
        <strong>{resultText || "Waiting for decision"}</strong>
      </div>
    </section>
  );
}
