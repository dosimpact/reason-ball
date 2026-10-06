import { useStream } from "@langchain/langgraph-sdk/react";
import { useCallback, useEffect } from "react";
import {
  createClientId,
  extractLatestMessageText,
  langGraphApiUrl,
} from "../../lib/langgraphClient";
import { StreamingState, coerceProgressEvent, latestMessageText } from "./data";
import { useStreamingReactHookState } from "./useStreamingReactHookState";

export function useStreamingReactHook() {
  const {
    prepareRunStream,
    prepareResetView,
    mode,
    setMode,
    prompt,
    setPrompt,
    threadId,
    setThreadId,
    status,
    setStatus,
    runId,
    setRunId,
    updates,
    setUpdates,
    values,
    setValues,
    customEvents,
    setCustomEvents,
    events,
    setEvents,
    valueSnapshotRef,
  } = useStreamingReactHookState();

  const addEvent = useCallback(
    (event: string, data: unknown, nextRunId?: string) => {
      setEvents((current) =>
        [
          {
            id: createClientId("stream"),
            event,
            runId: nextRunId,
            data,
            receivedAt: new Date().toLocaleTimeString(),
          },
          ...current,
        ].slice(0, 80),
      );
      if (nextRunId) setRunId(nextRunId);
    },
    [],
  );

  const stream = useStream<StreamingState>({
    apiUrl: langGraphApiUrl,
    assistantId: "04_streaming_ui",
    threadId,
    onThreadId: setThreadId,
    onCreated(run) {
      setStatus("Run created");
      addEvent("created", run, run.run_id);
    },
    onMetadataEvent(data) {
      addEvent("metadata", data, data.run_id);
    },
    onUpdateEvent(data) {
      setStatus("Streaming: updates");
      setUpdates((current) => [data, ...current].slice(0, 20));
      addEvent("updates", data);
    },
    onCustomEvent(data) {
      setStatus("Streaming: custom");
      setCustomEvents((current) =>
        [coerceProgressEvent(data), ...current].slice(0, 20),
      );
      addEvent("custom", data);
    },
    onFinish(state, run) {
      const stateValues = state.values ?? state;
      setStatus("Run complete");
      setValues((current) => [stateValues, ...current].slice(0, 20));
      addEvent("finish", stateValues, run?.run_id);
    },
    onError(error, run) {
      setStatus("Run failed");
      addEvent("error", error, run?.run_id);
    },
  });

  useEffect(() => {
    const snapshot = JSON.stringify(stream.values);
    if (mode !== "values" || snapshot === valueSnapshotRef.current) return;
    valueSnapshotRef.current = snapshot;
    setValues((current) => [stream.values, ...current].slice(0, 20));
    addEvent("values", stream.values);
  }, [addEvent, mode, stream.values]);

  const tokenText =
    latestMessageText(stream.values.messages) ||
    latestMessageText(stream.messages as StreamingState["messages"]) ||
    extractLatestMessageText(stream.values) ||
    "";

  async function runStream() {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    prepareRunStream();
    valueSnapshotRef.current = "";
    setStatus(`Submitting ${mode} stream with useStream`);

    await stream.submit(
      { prompt: trimmed, progress: [] },
      {
        streamMode: [mode],
      },
    );
  }

  function resetView() {
    stream.switchThread(null);
    prepareResetView();
    valueSnapshotRef.current = "";
    setStatus("Idle");
  }
  return {
    mode,
    setMode,
    prompt,
    setPrompt,
    threadId,
    status,
    runId,
    updates,
    values,
    customEvents,
    events,
    stream,
    tokenText,
    runStream,
    resetView,
  };
}
