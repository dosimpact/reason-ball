import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import {
  buildComparison,
  normalizeHistory,
  replayCandidate,
  valuesOf,
} from "./data";
import { useTimeTravelReplayState } from "./useTimeTravelReplayState";

export function useTimeTravelReplay() {
  const {
    prepareRunOriginal,
    topic,
    setTopic,
    replayTopic,
    setReplayTopic,
    replayInstruction,
    setReplayInstruction,
    threadId,
    setThreadId,
    status,
    setStatus,
    history,
    setHistory,
    selectedCheckpointId,
    setSelectedCheckpointId,
    originalState,
    setOriginalState,
    replayState,
    setReplayState,
    replaySourceCheckpointId,
    setReplaySourceCheckpointId,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  } = useTimeTravelReplayState();

  const client = useMemo(() => createLangGraphClient(), []);

  const selectedCheckpoint =
    history.find((entry) => entry.id === selectedCheckpointId) ?? null;

  const comparisonRows = buildComparison(originalState, replayState);

  const changedRows = comparisonRows.filter((row) => row.status !== "same");

  async function refreshHistory(
    activeThreadId: string,
    preferredCheckpointId?: string,
  ) {
    const historyPage = await client.threads.getHistory(activeThreadId, {
      limit: 30,
    });
    const normalized = normalizeHistory(historyPage);
    setHistory(normalized);
    const preferred = preferredCheckpointId
      ? normalized.find((entry) => entry.id === preferredCheckpointId)
      : replayCandidate(normalized);
    setSelectedCheckpointId(preferred?.id ?? normalized[0]?.id ?? "");
    return normalized;
  }

  async function runOriginal() {
    const trimmed = topic.trim();
    if (!trimmed) return;

    prepareRunOriginal();

    try {
      const thread = await client.threads.create({
        metadata: {
          example: "08-time-travel-replay-ui",
          flow: "original",
          topic: trimmed,
        },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming original run");

      const stream = await client.runs.stream(
        nextThreadId,
        "08_time_travel_replay",
        {
          input: {
            topic: trimmed,
            replay_instruction:
              "Create the original baseline before any replay branch.",
            run_label: "original",
            source_checkpoint_id: "initial",
          },
          streamMode: "updates",
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 100));
        setStatus(`Original stream: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      setOriginalState(valuesOf(state));
      const normalized = await refreshHistory(nextThreadId);
      setSelectedCheckpointId(
        replayCandidate(normalized)?.id ?? normalized[0]?.id ?? "",
      );
      setStatus("Original complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Original failed");
    } finally {
      setBusy(false);
    }
  }

  async function runReplay() {
    if (!threadId || !selectedCheckpoint) return;
    const trimmedTopic = replayTopic.trim();
    const trimmedInstruction = replayInstruction.trim();
    if (!trimmedTopic || !trimmedInstruction) return;

    setBusy(true);
    setError("");
    setReplayState(null);
    setReplaySourceCheckpointId(selectedCheckpoint.id);
    setStatus("Replaying from selected checkpoint");

    try {
      const stream = await client.runs.stream(
        threadId,
        "08_time_travel_replay",
        {
          input: {
            topic: trimmedTopic,
            replay_instruction: trimmedInstruction,
            run_label: "fork",
            source_checkpoint_id: selectedCheckpoint.id,
          },
          checkpointId: selectedCheckpoint.id,
          streamMode: "updates",
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 100));
        setStatus(`Replay stream: ${logEntry.event}`);
      }

      const replay = await client.threads.getState(threadId);
      setReplayState(valuesOf(replay));
      await refreshHistory(threadId, selectedCheckpoint.id);
      setStatus("Replay complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Replay failed");
    } finally {
      setBusy(false);
    }
  }

  const originalResult = String(originalState?.final ?? "");

  const replayResult = String(replayState?.final ?? "");
  return {
    topic,
    setTopic,
    replayTopic,
    setReplayTopic,
    replayInstruction,
    setReplayInstruction,
    threadId,
    status,
    history,
    selectedCheckpointId,
    setSelectedCheckpointId,
    replaySourceCheckpointId,
    events,
    error,
    busy,
    selectedCheckpoint,
    comparisonRows,
    changedRows,
    resetView,
    runOriginal,
    runReplay,
    originalResult,
    replayResult,
  };
}
