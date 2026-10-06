import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { buildDiff, normalizeHistory, valuesOf } from "./data";
import { useCheckpointStateHistoryState } from "./useCheckpointStateHistoryState";

export function useCheckpointStateHistory() {
  const {
    prepareRunCheckpointHistory,
    topic,
    setTopic,
    threadId,
    setThreadId,
    status,
    setStatus,
    currentState,
    setCurrentState,
    history,
    setHistory,
    selectedCheckpointId,
    setSelectedCheckpointId,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  } = useCheckpointStateHistoryState();

  const client = useMemo(() => createLangGraphClient(), []);

  const selectedCheckpoint =
    history.find((entry) => entry.id === selectedCheckpointId) ?? null;

  const diffRows = buildDiff(
    selectedCheckpoint?.values ?? {},
    currentState ?? {},
  );

  async function refreshStateAndHistory(activeThreadId: string) {
    const [state, historyPage] = await Promise.all([
      client.threads.getState(activeThreadId),
      client.threads.getHistory(activeThreadId, { limit: 20 }),
    ]);
    const currentValues = valuesOf(state);
    const normalized = normalizeHistory(historyPage);
    setCurrentState(currentValues);
    setHistory(normalized);
    setSelectedCheckpointId(normalized[1]?.id ?? normalized[0]?.id ?? "");
  }

  async function runCheckpointHistory() {
    const trimmed = topic.trim();
    if (!trimmed) return;

    prepareRunCheckpointHistory();

    try {
      const thread = await client.threads.create({
        metadata: { example: "07-checkpoint-state-history-ui", topic: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming checkpointed run");

      const stream = await client.runs.stream(
        nextThreadId,
        "07_checkpoint_state_history",
        {
          input: { topic: trimmed },
          streamMode: "updates",
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 80));
        setStatus(`Streaming: ${logEntry.event}`);
      }

      await refreshStateAndHistory(nextThreadId);
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
    currentState,
    history,
    selectedCheckpointId,
    setSelectedCheckpointId,
    events,
    error,
    busy,
    selectedCheckpoint,
    diffRows,
    resetView,
    runCheckpointHistory,
  };
}
