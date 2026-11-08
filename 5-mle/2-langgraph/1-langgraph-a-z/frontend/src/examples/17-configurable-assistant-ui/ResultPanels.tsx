import { Sliders } from "lucide-react";
import { type ConfigurableAssistantController } from "./useConfigurableAssistant";

// Typed display panels receive only the state and callbacks they render.
type RunStatusPanelProps = Pick<
  ConfigurableAssistantController,
  "style" | "status" | "defaultRun" | "overrideRun" | "latestConfig"
>;

export function RunStatusPanel({
  style,
  status,
  defaultRun,
  overrideRun,
  latestConfig,
}: RunStatusPanelProps) {
  return (
    <div className="run-status-panel" role="region" aria-label="Run Status">
      <div className="panel-title">
        <Sliders aria-hidden="true" size={18} />
        Run Status
      </div>
      <div className="config-status-grid">
        <div>
          <span>Status</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span>Default Run</span>
          <strong>{defaultRun ? "complete" : "pending"}</strong>
        </div>
        <div>
          <span>Override Run</span>
          <strong>{overrideRun ? "complete" : "pending"}</strong>
        </div>
        <div>
          <span>Latest Style</span>
          <strong>{latestConfig?.style ?? "pending"}</strong>
        </div>
      </div>
    </div>
  );
}

type EffectiveConfigPanelProps = Pick<
  ConfigurableAssistantController,
  "model" | "style" | "temperature" | "systemPrompt" | "latestConfig"
>;

export function EffectiveConfigPanel({
  model,
  style,
  temperature,
  systemPrompt,
  latestConfig,
}: EffectiveConfigPanelProps) {
  return (
    <div
      className="effective-config-panel"
      role="region"
      aria-label="Effective Config"
    >
      <div className="panel-title">Effective Config</div>
      {latestConfig ? (
        <div className="effective-config-grid">
          <div>
            <span>Model</span>
            <strong>{latestConfig.model}</strong>
            <code>{latestConfig.resolvedModel}</code>
          </div>
          <div>
            <span>Style</span>
            <strong>{latestConfig.style}</strong>
            <code>{latestConfig.styleHint}</code>
          </div>
          <div>
            <span>Temperature</span>
            <strong>{latestConfig.temperature}</strong>
          </div>
          <div>
            <span>System Prompt</span>
            <strong>{latestConfig.systemPrompt}</strong>
          </div>
        </div>
      ) : (
        <p className="muted">
          Run a config to see the effective runtime settings.
        </p>
      )}
    </div>
  );
}

type OutputComparisonPanelProps = Pick<
  ConfigurableAssistantController,
  "threadId" | "defaultRun" | "overrideRun"
>;

export function OutputComparisonPanel({
  threadId,
  defaultRun,
  overrideRun,
}: OutputComparisonPanelProps) {
  return (
    <div
      className="output-comparison-panel"
      role="region"
      aria-label="Output Comparison"
    >
      <div className="panel-title">Output Comparison</div>
      <div className="run-result-grid">
        {[defaultRun, overrideRun].map((run, index) => (
          <article
            key={index === 0 ? "default" : "override"}
            className="run-result-card"
          >
            <strong>{index === 0 ? "Default Run" : "Override Run"}</strong>
            {run ? (
              <>
                <span>{run.summary}</span>
                <p>{run.response}</p>
                <code>{run.threadId}</code>
              </>
            ) : (
              <p className="muted">No result yet.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

type ConfigDiffPanelProps = Pick<ConfigurableAssistantController, "diffRows">;

export function ConfigDiffPanel({ diffRows }: ConfigDiffPanelProps) {
  return (
    <div className="config-diff-panel" role="region" aria-label="Config Diff">
      <div className="panel-title">Config Diff</div>
      <div className="config-diff-table">
        <div className="config-diff-heading">
          <span>Field</span>
          <span>Default</span>
          <span>Override</span>
        </div>
        {diffRows.map(([field, left, right]) => (
          <div
            key={field}
            className={
              left === right
                ? "config-diff-row same"
                : "config-diff-row changed"
            }
          >
            <strong>{field}</strong>
            <span>{left}</span>
            <span>{right}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ConfigEventsPanelProps = Pick<
  ConfigurableAssistantController,
  "model" | "style" | "temperature" | "configEvents"
>;

export function ConfigEventsPanel({
  model,
  style,
  temperature,
  configEvents,
}: ConfigEventsPanelProps) {
  return (
    <div
      className="config-events-panel"
      role="region"
      aria-label="Config Events"
    >
      <div className="panel-title">Config Events</div>
      <div className="config-event-list">
        {configEvents.length === 0 ? (
          <p className="muted">Config custom events will appear here.</p>
        ) : (
          configEvents.map((event, index) => (
            <div
              key={`${event.runLabel}-${event.model}-${event.style}-${index}`}
              className="config-event"
            >
              <strong>{event.runLabel}</strong>
              <span>
                {event.model} / {event.style}
              </span>
              <code>temperature {event.temperature}</code>
              <code>{event.type}</code>
              <p>{event.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type FinalAnswerPanelProps = Pick<
  ConfigurableAssistantController,
  "defaultRun" | "overrideRun"
>;

export function FinalAnswerPanel({
  defaultRun,
  overrideRun,
}: FinalAnswerPanelProps) {
  return (
    <div className="final-answer-panel" role="region" aria-label="Final Answer">
      <div className="panel-title">Final Answer</div>
      <div className="answer-box">
        {overrideRun?.response || defaultRun?.response || "No answer yet."}
      </div>
    </div>
  );
}
