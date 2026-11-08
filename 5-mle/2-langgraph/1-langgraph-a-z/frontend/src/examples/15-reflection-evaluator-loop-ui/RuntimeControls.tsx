import { ClipboardCheck, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samples, retryPolicies } from "./data";
import { type ReflectionEvaluatorLoopController } from "./useReflectionEvaluatorLoop";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  ReflectionEvaluatorLoopController,
  | "request"
  | "setRequest"
  | "maxAttempts"
  | "setMaxAttempts"
  | "retryPolicy"
  | "setRetryPolicy"
  | "threadId"
  | "status"
  | "iterations"
  | "error"
  | "busy"
  | "resetView"
  | "runLoop"
>;

export function RuntimeControls({
  request,
  setRequest,
  maxAttempts,
  setMaxAttempts,
  retryPolicy,
  setRetryPolicy,
  threadId,
  status,
  iterations,
  error,
  busy,
  resetView,
  runLoop,
}: RuntimeControlsProps) {
  return (
    <aside className="reflection-control">
      <div className="panel-title">
        <ClipboardCheck aria-hidden="true" size={18} />
        Reflection Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="sample-list" aria-label="Reflection request samples">
        {samples.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="sample-button"
            onClick={() => setRequest(sample.value)}
            disabled={busy}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <div className="mode-picker" role="radiogroup" aria-label="Retry policy">
        {retryPolicies.map((policy) => (
          <button
            key={policy.value}
            type="button"
            role="radio"
            aria-checked={retryPolicy === policy.value}
            className={
              retryPolicy === policy.value
                ? "mode-option active"
                : "mode-option"
            }
            onClick={() => setRetryPolicy(policy.value)}
            disabled={busy}
          >
            <strong>{policy.label}</strong>
            <span>{policy.detail}</span>
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runLoop();
        }}
        className="run-form"
      >
        <label className="field">
          <span>Request</span>
          <textarea
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            rows={6}
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
        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !request.trim()}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run reflection loop
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
          <span>Iterations</span>
          <strong>{iterations.length}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
