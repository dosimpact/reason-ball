import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads } from "./data";
import { useReflectionEvaluatorLoopState } from "./useReflectionEvaluatorLoopState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useReflectionEvaluatorLoop() {
  const state = useReflectionEvaluatorLoopState();
  const {
    request,
    maxAttempts,
    retryPolicy,
    setThreadId,
    setStatus,
    setEvents,
    setError,
    setBusy,
    applyValues,
    applyCustomEvent,
    prepareRunLoop,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runLoop() {
    const trimmed = request.trim();
    if (!trimmed) return;

    prepareRunLoop();

    try {
      const thread = await client.threads.create({
        metadata: { example: "15-reflection-evaluator-loop-ui", retryPolicy },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming reflection loop");

      const stream = await client.runs.stream(
        nextThreadId,
        "15_reflection_evaluator_loop",
        {
          input: {
            request: trimmed,
            max_attempts: maxAttempts,
            retry_policy: retryPolicy,
          },
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
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return {
    request: state.request,
    setRequest: state.setRequest,
    maxAttempts: state.maxAttempts,
    setMaxAttempts: state.setMaxAttempts,
    retryPolicy: state.retryPolicy,
    setRetryPolicy: state.setRetryPolicy,
    threadId: state.threadId,
    status: state.status,
    loopStatus: state.loopStatus,
    currentIteration: state.currentIteration,
    iterations: state.iterations,
    loopEvents: state.loopEvents,
    draft: state.draft,
    verdict: state.verdict,
    score: state.score,
    feedback: state.feedback,
    requiredChanges: state.requiredChanges,
    stopReason: state.stopReason,
    finalAnswer: state.finalAnswer,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    rejectedIterations: state.rejectedIterations,
    acceptedIteration: state.acceptedIteration,
    resetView: state.resetView,
    runLoop,
  };
}

export type ReflectionEvaluatorLoopController = ReturnType<
  typeof useReflectionEvaluatorLoop
>;
