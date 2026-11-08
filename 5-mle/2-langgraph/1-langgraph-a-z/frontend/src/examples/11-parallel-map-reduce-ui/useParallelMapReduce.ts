import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { nodePayloads, valuesOf } from "./data";
import { useParallelMapReduceState } from "./useParallelMapReduceState";

export function useParallelMapReduce() {
  const {
    prepareRunMapReduce,
    topic,
    setTopic,
    threadId,
    setThreadId,
    status,
    setStatus,
    workers,
    setWorkers,
    reducerInputs,
    setReducerInputs,
    reducerOutput,
    setReducerOutput,
    finalState,
    setFinalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
    applyValues,
    applyCustomEvent,
  } = useParallelMapReduceState();

  const client = useMemo(() => createLangGraphClient(), []);

  async function runMapReduce() {
    const trimmed = topic.trim();
    if (!trimmed) return;

    prepareRunMapReduce();

    try {
      const thread = await client.threads.create({
        metadata: { example: "11-parallel-map-reduce-ui", topic: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming parallel workers");

      const stream = await client.runs.stream(
        nextThreadId,
        "11_parallel_map_reduce",
        {
          input: { topic: trimmed },
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
    topic,
    setTopic,
    threadId,
    status,
    workers,
    reducerInputs,
    reducerOutput,
    finalState,
    events,
    error,
    busy,
    resetView,
    runMapReduce,
  };
}
