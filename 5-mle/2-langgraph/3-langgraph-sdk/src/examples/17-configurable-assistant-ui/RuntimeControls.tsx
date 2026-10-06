import {
  GitCompareArrows,
  Loader2,
  Play,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import {
  samples,
  styleOptions,
  modelOptions,
  type Style,
  type ModelAlias,
} from "./data";
import { type ConfigurableAssistantController } from "./useConfigurableAssistant";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  ConfigurableAssistantController,
  | "prompt"
  | "setPrompt"
  | "model"
  | "setModel"
  | "style"
  | "setStyle"
  | "temperature"
  | "setTemperature"
  | "systemPrompt"
  | "setSystemPrompt"
  | "status"
  | "threadId"
  | "defaultRun"
  | "overrideRun"
  | "error"
  | "busy"
  | "invalidTemperature"
  | "resetView"
  | "runConfigured"
  | "runComparison"
>;

export function RuntimeControls({
  prompt,
  setPrompt,
  model,
  setModel,
  style,
  setStyle,
  temperature,
  setTemperature,
  systemPrompt,
  setSystemPrompt,
  status,
  threadId,
  defaultRun,
  overrideRun,
  error,
  busy,
  invalidTemperature,
  resetView,
  runConfigured,
  runComparison,
}: RuntimeControlsProps) {
  return (
    <aside className="config-control" role="region" aria-label="Config Form">
      <div className="panel-title">
        <Settings2 aria-hidden="true" size={18} />
        Config Form
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="sample-list" aria-label="Configurable prompt samples">
        {samples.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="sample-button"
            onClick={() => setPrompt(sample.value)}
            disabled={busy}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runComparison();
        }}
        className="run-form"
      >
        <label className="field">
          <span>Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
          />
        </label>
        <label className="field">
          <span>Model alias</span>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value as ModelAlias)}
          >
            {modelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Style</span>
          <select
            value={style}
            onChange={(event) => setStyle(event.target.value as Style)}
          >
            {styleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Temperature</span>
          <input
            aria-label="Temperature"
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(event) => setTemperature(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>System prompt</span>
          <textarea
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            rows={4}
          />
        </label>
        {invalidTemperature ? (
          <p className="error-line">Temperature must be between 0 and 1.</p>
        ) : null}
        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !prompt.trim() || invalidTemperature}
          >
            {busy ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <GitCompareArrows size={16} />
            )}
            Compare configs
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void runConfigured("default")}
            disabled={busy || !prompt.trim() || invalidTemperature}
          >
            <Play size={16} />
            Run default
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void runConfigured("override")}
            disabled={busy || !prompt.trim() || invalidTemperature}
          >
            <Play size={16} />
            Run override
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
          <span>Runs</span>
          <strong>{[defaultRun, overrideRun].filter(Boolean).length}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
