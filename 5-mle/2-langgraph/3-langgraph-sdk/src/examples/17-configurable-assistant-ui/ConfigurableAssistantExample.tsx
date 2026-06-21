import { GitCompareArrows, Loader2, Play, RotateCcw, Settings2, Sliders } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();

const samples = [
  {
    label: "SDK Config",
    value: "Explain why LangGraph runtime configuration is useful for SDK learners.",
  },
  {
    label: "Assistant Tone",
    value: "Describe how changing a system prompt affects an assistant without changing graph code.",
  },
  {
    label: "Run Override",
    value: "Summarize why run-level config overrides are useful for testing product behavior.",
  },
];

const styleOptions = [
  { label: "Concise", value: "concise" },
  { label: "Detailed", value: "detailed" },
  { label: "Playful", value: "playful" },
  { label: "Strict", value: "strict" },
] as const;

const modelOptions = ["fast", "default", "normal", "smart"] as const;

type Style = (typeof styleOptions)[number]["value"];
type ModelAlias = (typeof modelOptions)[number];
type JsonRecord = Record<string, unknown>;

type EffectiveConfig = {
  model: string;
  resolvedModel: string;
  systemPrompt: string;
  style: string;
  temperature: number;
  styleHint: string;
};

type ConfigEvent = {
  type: string;
  runLabel: string;
  model: string;
  style: string;
  temperature: number;
  detail: string;
};

type RunResult = {
  label: string;
  threadId: string;
  response: string;
  summary: string;
  effectiveConfig: EffectiveConfig | null;
  finalState: JsonRecord | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function normalizeEffectiveConfig(value: unknown): EffectiveConfig | null {
  if (!isRecord(value)) return null;
  return {
    model: typeof value.model === "string" ? value.model : "",
    resolvedModel: typeof value.resolved_model === "string" ? value.resolved_model : "",
    systemPrompt: typeof value.system_prompt === "string" ? value.system_prompt : "",
    style: typeof value.style === "string" ? value.style : "",
    temperature: typeof value.temperature === "number" ? value.temperature : 0,
    styleHint: typeof value.style_hint === "string" ? value.style_hint : "",
  };
}

function normalizeConfigEvents(value: unknown): ConfigEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "config_applied",
    runLabel:
      typeof event.run_label === "string" ? event.run_label : String(event.runLabel ?? "run"),
    model: typeof event.model === "string" ? event.model : "",
    style: typeof event.style === "string" ? event.style : "",
    temperature: typeof event.temperature === "number" ? event.temperature : 0,
    detail: typeof event.detail === "string" ? event.detail : "",
  }));
}

function mergeConfigEvents(current: ConfigEvent[], next: ConfigEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next]
    .filter((event) => {
      const key = `${event.runLabel}:${event.model}:${event.style}:${event.temperature}:${event.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-30);
}

function runFromValues(label: string, threadId: string, values: JsonRecord): RunResult {
  return {
    label,
    threadId,
    response: typeof values.response === "string" ? values.response : "",
    summary: typeof values.response_summary === "string" ? values.response_summary : "",
    effectiveConfig: normalizeEffectiveConfig(values.effective_config),
    finalState: values,
  };
}

function configRows(defaultRun: RunResult | null, overrideRun: RunResult | null) {
  const left = defaultRun?.effectiveConfig;
  const right = overrideRun?.effectiveConfig;
  return [
    ["Model", left?.model ?? "pending", right?.model ?? "pending"],
    ["Resolved model", left?.resolvedModel ?? "pending", right?.resolvedModel ?? "pending"],
    ["Style", left?.style ?? "pending", right?.style ?? "pending"],
    ["Temperature", String(left?.temperature ?? "pending"), String(right?.temperature ?? "pending")],
    ["System prompt", left?.systemPrompt ?? "pending", right?.systemPrompt ?? "pending"],
  ];
}

export function ConfigurableAssistantExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [prompt, setPrompt] = useState(samples[0].value);
  const [model, setModel] = useState<ModelAlias>("fast");
  const [style, setStyle] = useState<Style>("detailed");
  const [temperature, setTemperature] = useState(0.2);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a strict senior engineer explaining LangGraph SDK behavior.",
  );
  const [status, setStatus] = useState("Idle");
  const [threadId, setThreadId] = useState("");
  const [defaultRun, setDefaultRun] = useState<RunResult | null>(null);
  const [overrideRun, setOverrideRun] = useState<RunResult | null>(null);
  const [latestConfig, setLatestConfig] = useState<EffectiveConfig | null>(null);
  const [configEvents, setConfigEvents] = useState<ConfigEvent[]>([]);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
  const diffRows = useMemo(() => configRows(defaultRun, overrideRun), [defaultRun, overrideRun]);
  const invalidTemperature = temperature < 0 || temperature > 1 || Number.isNaN(temperature);

  function resetView() {
    setStatus("Idle");
    setThreadId("");
    setDefaultRun(null);
    setOverrideRun(null);
    setLatestConfig(null);
    setConfigEvents([]);
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    const effective = normalizeEffectiveConfig(values.effective_config);
    if (effective) {
      setLatestConfig(effective);
    }
    if (Array.isArray(values.config_events)) {
      setConfigEvents((current) => mergeConfigEvents(current, normalizeConfigEvents(values.config_events)));
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "config_applied") return;
    setConfigEvents((current) => mergeConfigEvents(current, normalizeConfigEvents([data])));
  }

  async function runConfigured(label: "default" | "override") {
    const trimmed = prompt.trim();
    if (!trimmed || invalidTemperature) return null;

    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(`Creating ${label} config thread`);

    try {
      const thread = await client.threads.create({
        metadata: { example: "17-configurable-assistant-ui", label },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus(`Streaming ${label} config`);

      const configurable =
        label === "override"
          ? {
              model,
              style,
              temperature,
              system_prompt: systemPrompt,
            }
          : {};

      const stream = await client.runs.stream(nextThreadId, "configurable_assistant", {
        input: { prompt: trimmed, run_label: label },
        config: { configurable },
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 120));
        if (logEntry.event === "custom") {
          applyCustomEvent(logEntry.data);
        }
        for (const payload of nodePayloads(logEntry.data)) {
          applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      applyValues(values);
      const result = runFromValues(label, nextThreadId, values);
      if (label === "default") setDefaultRun(result);
      else setOverrideRun(result);
      setStatus("Run complete");
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function runComparison(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setDefaultRun(null);
    setOverrideRun(null);
    setConfigEvents([]);
    const first = await runConfigured("default");
    if (first) {
      await runConfigured("override");
    }
  }

  return (
    <section className="configurable-layout">
      <aside className="config-control" role="region" aria-label="Config Form">
        <div className="panel-title">
          <Settings2 aria-hidden="true" size={18} />
          Config Form
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
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
        <form onSubmit={runComparison} className="run-form">
          <label className="field">
            <span>Prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
          </label>
          <label className="field">
            <span>Model alias</span>
            <select value={model} onChange={(event) => setModel(event.target.value as ModelAlias)}>
              {modelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Style</span>
            <select value={style} onChange={(event) => setStyle(event.target.value as Style)}>
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
            <button type="submit" className="primary-button" disabled={busy || !prompt.trim() || invalidTemperature}>
              {busy ? <Loader2 className="spin" size={16} /> : <GitCompareArrows size={16} />}
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
            <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
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

      <div className="effective-config-panel" role="region" aria-label="Effective Config">
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
          <p className="muted">Run a config to see the effective runtime settings.</p>
        )}
      </div>

      <div className="output-comparison-panel" role="region" aria-label="Output Comparison">
        <div className="panel-title">Output Comparison</div>
        <div className="run-result-grid">
          {[defaultRun, overrideRun].map((run, index) => (
            <article key={index === 0 ? "default" : "override"} className="run-result-card">
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

      <div className="config-diff-panel" role="region" aria-label="Config Diff">
        <div className="panel-title">Config Diff</div>
        <div className="config-diff-table">
          <div className="config-diff-heading">
            <span>Field</span>
            <span>Default</span>
            <span>Override</span>
          </div>
          {diffRows.map(([field, left, right]) => (
            <div key={field} className={left === right ? "config-diff-row same" : "config-diff-row changed"}>
              <strong>{field}</strong>
              <span>{left}</span>
              <span>{right}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="config-events-panel" role="region" aria-label="Config Events">
        <div className="panel-title">Config Events</div>
        <div className="config-event-list">
          {configEvents.length === 0 ? (
            <p className="muted">Config custom events will appear here.</p>
          ) : (
            configEvents.map((event, index) => (
              <div key={`${event.runLabel}-${event.model}-${event.style}-${index}`} className="config-event">
                <strong>{event.runLabel}</strong>
                <span>{event.model} / {event.style}</span>
                <code>temperature {event.temperature}</code>
                <code>{event.type}</code>
                <p>{event.detail}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box">{overrideRun?.response || defaultRun?.response || "No answer yet."}</div>
      </div>

      <div className="state-panel config-final-state" role="region" aria-label="Final State">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
      </div>

      <div className="event-panel" role="region" aria-label="Raw Stream Events">
        <div className="panel-title">Raw Stream Events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            events.map((entry) => (
              <details key={entry.id} className="event-row">
                <summary>
                  <span>{entry.receivedAt}</span>
                  <strong>event {entry.event}</strong>
                </summary>
                <pre>{formatJson(entry.data)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
