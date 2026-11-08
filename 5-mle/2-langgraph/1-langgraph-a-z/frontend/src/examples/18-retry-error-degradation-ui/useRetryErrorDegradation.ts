import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads } from "./data";
import { useRetryErrorDegradationState } from "./useRetryErrorDegradationState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useRetryErrorDegradation() {
  const state = useRetryErrorDegradationState();
  const {
    query,
    failureMode,
    maxAttempts,
    fallbackEnabled,
    setThreadId,
    setStatus,
    setEvents,
    setError,
    setBusy,
    applyValues,
    applyCustomEvent,
    prepareRunRetryDemo,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runRetryDemo() {
    const trimmed = query.trim();
    if (!trimmed) return;

    prepareRunRetryDemo();

    try {
      const thread = await client.threads.create({
        metadata: { example: "18-retry-error-degradation-ui", failureMode },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming retry demo");
      const stream = await client.runs.stream(
        nextThreadId,
        "18_retry_error_degradation",
        {
          input: {
            query: trimmed,
            failure_mode: failureMode,
            max_attempts: maxAttempts,
            fallback_enabled:
              fallbackEnabled && failureMode !== "final_failure",
          },
          streamMode: ["updates", "custom"] as ["updates", "custom"],
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 140));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      applyValues(values);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return {
    query: state.query,
    setQuery: state.setQuery,
    failureMode: state.failureMode,
    setFailureMode: state.setFailureMode,
    maxAttempts: state.maxAttempts,
    setMaxAttempts: state.setMaxAttempts,
    fallbackEnabled: state.fallbackEnabled,
    setFallbackEnabled: state.setFallbackEnabled,
    threadId: state.threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    retryStatus: state.retryStatus,
    currentAttempt: state.currentAttempt,
    attempts: state.attempts,
    errors: state.errors,
    retryEvents: state.retryEvents,
    primaryResult: state.primaryResult,
    fallbackResult: state.fallbackResult,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    usedStrategy: state.usedStrategy,
    resetView: state.resetView,
    runRetryDemo,
  };
}

export type RetryErrorDegradationController = ReturnType<
  typeof useRetryErrorDegradation
>;
