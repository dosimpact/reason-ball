import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads } from "./data";
import { useObservabilityState } from "./useObservabilityState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useObservability() {
  const state = useObservabilityState();
  const {
    query,
    setThreadId,
    setStatus,
    setEvents,
    setError,
    setBusy,
    applyValues,
    applyCustomEvent,
    prepareRunObservableGraph,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runObservableGraph() {
    const trimmed = query.trim();
    if (!trimmed) return;

    prepareRunObservableGraph();

    try {
      const thread = await client.threads.create({
        metadata: { example: "20-observability-ui" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming observable graph");
      const stream = await client.runs.stream(
        nextThreadId,
        "20_observability",
        {
          input: { query: trimmed, run_label: "ui-observable-run" },
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
      applyValues(valuesOf(state));
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
    threadId: state.threadId,
    runId: state.runId,
    status: state.status,
    nodeTimings: state.nodeTimings,
    tokenMetrics: state.tokenMetrics,
    costSummary: state.costSummary,
    traceLinks: state.traceLinks,
    runMetadata: state.runMetadata,
    observabilityEvents: state.observabilityEvents,
    answer: state.answer,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    totalElapsed: state.totalElapsed,
    llmCalls: state.llmCalls,
    resetView: state.resetView,
    runObservableGraph,
  };
}

export type ObservabilityController = ReturnType<typeof useObservability>;
