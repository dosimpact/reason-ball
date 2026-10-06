import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads, runFromValues } from "./data";
import { useConfigurableAssistantState } from "./useConfigurableAssistantState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useConfigurableAssistant() {
  const state = useConfigurableAssistantState();
  const {
    prompt,
    model,
    style,
    temperature,
    systemPrompt,
    setStatus,
    setThreadId,
    setDefaultRun,
    setOverrideRun,
    setEvents,
    setError,
    setBusy,
    invalidTemperature,
    applyValues,
    applyCustomEvent,
    prepareRunConfigured,
    prepareRunComparison,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runConfigured(label: "default" | "override") {
    const trimmed = prompt.trim();
    if (!trimmed || invalidTemperature) return null;

    prepareRunConfigured(label);

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

      const stream = await client.runs.stream(
        nextThreadId,
        "17_configurable_assistant",
        {
          input: { prompt: trimmed, run_label: label },
          config: { configurable },
          streamMode: ["updates", "custom"] as ["updates", "custom"],
        },
      );

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

  async function runComparison() {
    prepareRunComparison();
    const first = await runConfigured("default");
    if (first) {
      await runConfigured("override");
    }
  }

  return {
    prompt: state.prompt,
    setPrompt: state.setPrompt,
    model: state.model,
    setModel: state.setModel,
    style: state.style,
    setStyle: state.setStyle,
    temperature: state.temperature,
    setTemperature: state.setTemperature,
    systemPrompt: state.systemPrompt,
    setSystemPrompt: state.setSystemPrompt,
    status: state.status,
    threadId: state.threadId,
    defaultRun: state.defaultRun,
    overrideRun: state.overrideRun,
    latestConfig: state.latestConfig,
    configEvents: state.configEvents,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    diffRows: state.diffRows,
    invalidTemperature: state.invalidTemperature,
    resetView: state.resetView,
    runConfigured,
    runComparison,
  };
}

export type ConfigurableAssistantController = ReturnType<
  typeof useConfigurableAssistant
>;
