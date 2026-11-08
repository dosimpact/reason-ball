import { Loader2, Play, RotateCcw, Server } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import {
  ResultsPanel,
  StatePanelView,
  StreamEventsPanel,
} from "./ResultsPanels";
import { useSdkConnectionReactHook } from "./useSdkConnectionReactHook";

export function SdkConnectionReactHookExample() {
  const {
    threadId,
    prompt,
    setPrompt,
    status,
    runId,
    events,
    stream,
    answer,
    runAssistant,
    resetView,
  } = useSdkConnectionReactHook();
  return (
    <section className="example-grid">
      <div className="control-panel">
        <div className="panel-title">
          <Server aria-hidden="true" size={18} />
          React Hook Runtime
        </div>

        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>

        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{stream.isLoading ? "Streaming" : status}</strong>
          </div>
          <div>
            <span>Assistant</span>
            <strong>sdk_connection</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "auto-created"}</strong>
          </div>
          <div>
            <span>Run</span>
            <strong>{runId || "pending"}</strong>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runAssistant();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Input</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
            />
          </label>
          <div className="button-row">
            <button
              type="submit"
              className="primary-button"
              disabled={stream.isLoading || !prompt.trim()}
            >
              {stream.isLoading ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              Submit with useStream
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetView}
              disabled={stream.isLoading}
            >
              <RotateCcw size={16} />
              Reset thread
            </button>
          </div>
        </form>

        {stream.error ? (
          <p className="error-line">{String(stream.error)}</p>
        ) : null}
      </div>

      <ResultsPanel answer={answer} />

      <StreamEventsPanel runId={runId} events={events} />

      <StatePanelView stream={stream} />
    </section>
  );
}
