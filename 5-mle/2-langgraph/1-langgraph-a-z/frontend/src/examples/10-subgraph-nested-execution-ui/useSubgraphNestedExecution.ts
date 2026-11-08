import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { namespaceFromEvent, nodePayloads, valuesOf } from "./data";
import { useSubgraphNestedExecutionState } from "./useSubgraphNestedExecutionState";

export function useSubgraphNestedExecution() {
  const {
    prepareRunNestedGraph,
    applyValues,
    request,
    setRequest,
    threadId,
    setThreadId,
    status,
    setStatus,
    selectedTeam,
    setSelectedTeam,
    breadcrumb,
    setBreadcrumb,
    parentSteps,
    setParentSteps,
    subgraphSteps,
    setSubgraphSteps,
    parentMessages,
    setParentMessages,
    subgraphMessages,
    setSubgraphMessages,
    parentState,
    setParentState,
    subgraphState,
    setSubgraphState,
    finalState,
    setFinalState,
    final,
    setFinal,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  } = useSubgraphNestedExecutionState();

  const client = useMemo(() => createLangGraphClient(), []);

  async function runNestedGraph() {
    const trimmed = request.trim();
    if (!trimmed) return;

    prepareRunNestedGraph();

    try {
      const thread = await client.threads.create({
        metadata: {
          example: "10-subgraph-nested-execution-ui",
          request: trimmed,
        },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming parent and subgraph updates");

      const stream = await client.runs.stream(
        nextThreadId,
        "10_subgraph_nested_execution",
        {
          input: { request: trimmed },
          streamMode: "updates",
          streamSubgraphs: true,
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        const namespace = namespaceFromEvent(logEntry.event);
        setEvents((current) => [logEntry, ...current].slice(0, 120));
        for (const payload of nodePayloads(logEntry.data)) {
          applyValues(payload);
        }
        setStatus(`Streaming ${namespace}: ${logEntry.event.split("|")[0]}`);
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
    request,
    setRequest,
    threadId,
    status,
    selectedTeam,
    breadcrumb,
    parentSteps,
    subgraphSteps,
    parentMessages,
    subgraphMessages,
    parentState,
    subgraphState,
    finalState,
    final,
    events,
    error,
    busy,
    resetView,
    runNestedGraph,
  };
}
