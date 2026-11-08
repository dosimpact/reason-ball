import { Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import {
  FinalStateView,
  InterruptApprovalPayloadView,
  ResultsPanel,
  StreamEventsPanel,
} from "./ResultsPanels";
import { useHumanInTheLoopInterrupt } from "./useHumanInTheLoopInterrupt";

export function HumanInTheLoopInterruptExample() {
  const {
    action,
    setAction,
    editText,
    setEditText,
    threadId,
    pendingThreadId,
    status,
    interruptPayload,
    finalState,
    events,
    error,
    busy,
    resetView,
    startRun,
    recoverPendingInterrupt,
    resumeRun,
    resultText,
  } = useHumanInTheLoopInterrupt();
  return (
    <section className="interrupt-layout">
      <aside className="interrupt-control">
        <div className="panel-title">
          <ShieldAlert aria-hidden="true" size={18} />
          Approval Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void startRun();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Action</span>
            <textarea
              value={action}
              onChange={(event) => setAction(event.target.value)}
              rows={4}
            />
          </label>
          <div className="button-row">
            <button
              type="submit"
              className="primary-button"
              disabled={busy || !action.trim()}
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <ShieldAlert size={16} />
              )}
              Start approval run
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetView}
              disabled={busy}
            >
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

      <InterruptApprovalPayloadView
        action={action}
        editText={editText}
        setEditText={setEditText}
        interruptPayload={interruptPayload}
        busy={busy}
        resumeRun={resumeRun}
      />

      <FinalStateView finalState={finalState} />

      <ResultsPanel resultText={resultText} />

      <StreamEventsPanel events={events} />
    </section>
  );
}
