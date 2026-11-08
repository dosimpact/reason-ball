import { Loader2, Play, RotateCcw, Waves } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { streamModes } from "./data";
import {
  ModePanelGridView,
  StatePanelView,
  StreamEventsPanel,
} from "./ResultsPanels";
import { useStreamingReactHook } from "./useStreamingReactHook";

export function StreamingReactHookExample() {
  const {
    mode,
    setMode,
    prompt,
    setPrompt,
    threadId,
    status,
    runId,
    updates,
    values,
    customEvents,
    events,
    stream,
    tokenText,
    runStream,
    resetView,
  } = useStreamingReactHook();
  return (
    <section className="streaming-layout">
      <div className="stream-control">
        <div className="panel-title">
          <Waves aria-hidden="true" size={18} />
          React Hook Stream Controls
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>

        <div className="mode-toggle" aria-label="Stream mode">
          {streamModes.map((item) => (
            <button
              key={item.mode}
              type="button"
              className={
                item.mode === mode ? "mode-button active" : "mode-button"
              }
              aria-pressed={item.mode === mode}
              onClick={() => setMode(item.mode)}
              disabled={stream.isLoading}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runStream();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Prompt</span>
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
              Run with useStream
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetView}
              disabled={stream.isLoading}
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>

        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{stream.isLoading ? "Streaming" : status}</strong>
          </div>
          <div>
            <span>Mode</span>
            <strong>{mode}</strong>
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
        {stream.error ? (
          <p className="error-line">{String(stream.error)}</p>
        ) : null}
      </div>

      <ModePanelGridView
        updates={updates}
        values={values}
        customEvents={customEvents}
        tokenText={tokenText}
      />

      <StatePanelView values={values} stream={stream} />

      <StreamEventsPanel runId={runId} events={events} />
    </section>
  );
}
