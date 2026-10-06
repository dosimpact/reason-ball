import * as R from "remeda";
import { useMemo, useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { samples, type Style, type ModelAlias, type JsonRecord, type EffectiveConfig, type ConfigEvent, type RunResult, normalizeEffectiveConfig, normalizeConfigEvents, mergeConfigEvents, configRows } from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useConfigurableAssistantState() {
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
  const [latestConfig, setLatestConfig] = useState<EffectiveConfig | null>(
    null,
  );
  const [configEvents, setConfigEvents] = useState<ConfigEvent[]>([]);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const diffRows = useMemo(
    () => configRows(defaultRun, overrideRun),
    [defaultRun, overrideRun],
  );

  const invalidTemperature =
    temperature < 0 || temperature > 1 || Number.isNaN(temperature);

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
    if (R.isArray(values.config_events)) {
      setConfigEvents((current) =>
        mergeConfigEvents(current, normalizeConfigEvents(values.config_events)),
      );
    }
    if (R.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "config_applied") return;
    setConfigEvents((current) =>
      mergeConfigEvents(current, normalizeConfigEvents([data])),
    );
  }

  function prepareRunConfigured(label: "default" | "override") {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(`Creating ${label} config thread`);
  }

  function prepareRunComparison() {
    setDefaultRun(null);
    setOverrideRun(null);
    setConfigEvents([]);
  }

  return {
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
    setStatus,
    threadId,
    setThreadId,
    defaultRun,
    setDefaultRun,
    overrideRun,
    setOverrideRun,
    latestConfig,
    configEvents,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    diffRows,
    invalidTemperature,
    resetView,
    applyValues,
    applyCustomEvent,
    prepareRunConfigured,
    prepareRunComparison,
  };
}
