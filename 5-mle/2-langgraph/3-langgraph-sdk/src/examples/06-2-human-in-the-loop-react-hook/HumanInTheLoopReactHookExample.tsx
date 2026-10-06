import { Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import {
  HookFinalStateView,
  ReactHookInterruptPayloadView,
  ResultsPanel,
  StreamEventsPanel,
} from "./ResultsPanels";
import { useHumanInTheLoopReactHook } from "./useHumanInTheLoopReactHook";

export function HumanInTheLoopReactHookExample() {
  const {
    action,
    setAction,
    editText,
    setEditText,
    threadId,
    events,
    status,
    interruptPayload,
    values,
    resultText,
    busy,
    startRun,
    resumeRun,
    resetView,
  } = useHumanInTheLoopReactHook();
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
              Start with useStream
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

      <ReactHookInterruptPayloadView
        action={action}
        editText={editText}
        setEditText={setEditText}
        interruptPayload={interruptPayload}
        busy={busy}
        resumeRun={resumeRun}
      />

      <StreamEventsPanel events={events} />

      <HookFinalStateView values={values} />

      <ResultsPanel resultText={resultText} />
    </section>
  );
}
