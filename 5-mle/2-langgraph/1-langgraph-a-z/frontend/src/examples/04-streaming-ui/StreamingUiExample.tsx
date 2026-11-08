import { Loader2, Play, RotateCcw, Waves } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { streamModes } from "./data";
import {
  ModePanelGridView,
  StatePanelView,
  StreamEventsPanel,
} from "./ResultsPanels";
import { useStreamingUi } from "./useStreamingUi";

export function StreamingUiExample() {
  const {
    mode,
    setMode,
    prompt,
    setPrompt,
    threadId,
    status,
    tokenText,
    updates,
    values,
    customEvents,
    finalState,
    events,
    error,
    busy,
    resetView,
    runStream,
  } = useStreamingUi();
  return (
    <section className="streaming-layout">
      <div className="stream-control">
        <div className="panel-title">
          <Waves aria-hidden="true" size={18} />
          Stream Controls
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
              disabled={busy}
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
              disabled={busy || !prompt.trim()}
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              Run stream
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
            <span>Mode</span>
            <strong>{mode}</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </div>

      <ModePanelGridView
        tokenText={tokenText}
        updates={updates}
        values={values}
        customEvents={customEvents}
      />

      <StatePanelView finalState={finalState} />

      <StreamEventsPanel events={events} />
    </section>
  );
}
