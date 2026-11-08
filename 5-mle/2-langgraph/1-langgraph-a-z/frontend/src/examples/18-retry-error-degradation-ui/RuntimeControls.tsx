import { Loader2, Play, RotateCcw, TimerReset } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samples, modes } from "./data";
import { type RetryErrorDegradationController } from "./useRetryErrorDegradation";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  RetryErrorDegradationController,
  | "query"
  | "setQuery"
  | "failureMode"
  | "setFailureMode"
  | "maxAttempts"
  | "setMaxAttempts"
  | "fallbackEnabled"
  | "setFallbackEnabled"
  | "threadId"
  | "status"
  | "attempts"
  | "error"
  | "busy"
  | "resetView"
  | "runRetryDemo"
>;

export function RuntimeControls({
  query,
  setQuery,
  failureMode,
  setFailureMode,
  maxAttempts,
  setMaxAttempts,
  fallbackEnabled,
  setFallbackEnabled,
  threadId,
  status,
  attempts,
  error,
  busy,
  resetView,
  runRetryDemo,
}: RuntimeControlsProps) {
  return (
    <aside className="retry-control">
      <div className="panel-title">
        <TimerReset aria-hidden="true" size={18} />
        Retry Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="sample-list" aria-label="Retry query samples">
        {samples.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="sample-button"
            onClick={() => setQuery(sample.value)}
            disabled={busy}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <div className="mode-picker" role="radiogroup" aria-label="Failure mode">
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={failureMode === mode.value}
            className={
              failureMode === mode.value ? "mode-option active" : "mode-option"
            }
            onClick={() => {
              setFailureMode(mode.value);
              setFallbackEnabled(mode.value !== "final_failure");
            }}
            disabled={busy}
          >
            <strong>{mode.label}</strong>
            <span>{mode.detail}</span>
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runRetryDemo();
        }}
        className="run-form"
      >
        <label className="field">
          <span>Query</span>
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={5}
          />
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
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={fallbackEnabled && failureMode !== "final_failure"}
            onChange={(event) => setFallbackEnabled(event.target.checked)}
            disabled={busy || failureMode === "final_failure"}
          />
          <span>Enable fallback</span>
        </label>
        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !query.trim()}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run retry demo
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
          <span>Attempts</span>
          <strong>{attempts.length}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
