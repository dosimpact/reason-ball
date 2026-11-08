import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads } from "./data";
import { useCustomEventRendererState } from "./useCustomEventRendererState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useCustomEventRenderer() {
  const state = useCustomEventRendererState();
  const {
    taskId,
    taskPrompt,
    setThreadId,
    setStatus,
    setFinalStatus,
    setEvents,
    setError,
    setBusy,
    applyValues,
    applyCustomEvent,
    prepareRunRenderer,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runRenderer() {
    const trimmedTask = taskPrompt.trim();
    const trimmedId = taskId.trim();
    if (!trimmedTask || !trimmedId) return;

    prepareRunRenderer();

    try {
      const thread = await client.threads.create({
        metadata: { example: "22-custom-event-renderer" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming custom events");
      const stream = await client.runs.stream(
        nextThreadId,
        "22_custom_event_renderer",
        {
          input: {
            task_id: trimmedId,
            task_prompt: trimmedTask,
          },
          streamMode: ["updates", "custom"] as ["updates", "custom"],
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 160));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
      setFinalStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  return {
    taskId: state.taskId,
    setTaskId: state.setTaskId,
    taskPrompt: state.taskPrompt,
    setTaskPrompt: state.setTaskPrompt,
    threadId: state.threadId,
    runId: state.runId,
    status: state.status,
    finalStatus: state.finalStatus,
    inlineEvents: state.inlineEvents,
    phaseRecords: state.phaseRecords,
    unknownEvents: state.unknownEvents,
    warnings: state.warnings,
    rendererMetadata: state.rendererMetadata,
    answer: state.answer,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    warningEvents: state.warningEvents,
    progressComplete: state.progressComplete,
    resetView: state.resetView,
    runRenderer,
  };
}

export type CustomEventRendererController = ReturnType<
  typeof useCustomEventRenderer
>;
