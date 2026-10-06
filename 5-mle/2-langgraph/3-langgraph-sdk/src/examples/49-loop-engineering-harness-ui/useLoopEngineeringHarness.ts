import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { nodePayloads, valuesOf } from "./model";

import { useLoopEngineeringHarnessState } from "./useLoopEngineeringHarnessState";

// SDK requests, browser input preparation, and stream consumption.
export function useLoopEngineeringHarness() {
  const state = useLoopEngineeringHarnessState();
  const {
    task,
    triggerType,
    maxAttempts,
    qualityThreshold,
    setStatus,
    setThreadId,
    setEvents,
    setBusy,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runHarness() {
    const trimmed = task.trim();
    if (!trimmed) return;

    startRun();

    try {
      const thread = await client.threads.create({
        metadata: { example: "49-loop-engineering-harness-ui" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming loop harness");

      const stream = await client.runs.stream(nextThreadId, "49_loop_engineering_harness", {
        input: {
          task: trimmed,
          trigger_type: triggerType,
          max_attempts: maxAttempts,
          quality_threshold: qualityThreshold,
        },
        streamMode: ["updates", "values", "custom"] as ["updates", "values", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 160));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        if (logEntry.event === "values") applyValues(valuesOf(logEntry.data));
        if (logEntry.event === "updates") {
          for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      failRun(caught);
    } finally {
      setBusy(false);
    }
  }

  return {
    task,
    setTask: state.setTask,
    triggerType,
    setTriggerType: state.setTriggerType,
    maxAttempts,
    setMaxAttempts: state.setMaxAttempts,
    qualityThreshold,
    setQualityThreshold: state.setQualityThreshold,
    status: state.status,
    threadId: state.threadId,
    activeLoop: state.activeLoop,
    attempts: state.attempts,
    toolCalls: state.toolCalls,
    verifications: state.verifications,
    traceEvents: state.traceEvents,
    suggestions: state.suggestions,
    finalAnswer: state.finalAnswer,
    stopReason: state.stopReason,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    latestVerification: state.latestVerification,
    resetView: state.resetView,
    runHarness,
  };
}
