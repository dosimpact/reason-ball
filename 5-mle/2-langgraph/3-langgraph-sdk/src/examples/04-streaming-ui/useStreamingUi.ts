import { useMemo } from "react";
import {
  createLangGraphClient,
  extractLatestMessageText,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { coerceProgressEvent, messageTextFromStream } from "./data";
import { useStreamingUiState } from "./useStreamingUiState";

export function useStreamingUi() {
  const {
    prepareRunStream,
    mode,
    setMode,
    prompt,
    setPrompt,
    threadId,
    setThreadId,
    status,
    setStatus,
    tokenText,
    setTokenText,
    updates,
    setUpdates,
    values,
    setValues,
    customEvents,
    setCustomEvents,
    finalState,
    setFinalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  } = useStreamingUiState();

  const client = useMemo(() => createLangGraphClient(), []);

  async function runStream() {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    prepareRunStream();
    setStatus(`Starting ${mode} stream`);

    try {
      const thread = await client.threads.create({
        metadata: { example: "04-streaming-ui", mode },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus(`Streaming ${mode}`);

      const stream = await client.runs.stream(nextThreadId, "04_streaming_ui", {
        input: { prompt: trimmed, progress: [] },
        streamMode: mode,
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 80));
        setStatus(`Streaming: ${logEntry.event}`);

        if (
          logEntry.event === "messages" ||
          logEntry.event.startsWith("messages/")
        ) {
          const text = messageTextFromStream(logEntry.data);
          if (text) {
            setTokenText((current) =>
              logEntry.event === "messages" ? `${current}${text}` : text,
            );
          }
        }

        if (logEntry.event === "updates") {
          setUpdates((current) => [logEntry.data, ...current].slice(0, 20));
        }

        if (logEntry.event === "values") {
          setValues((current) => [logEntry.data, ...current].slice(0, 20));
        }

        if (logEntry.event === "custom") {
          setCustomEvents((current) =>
            [coerceProgressEvent(logEntry.data), ...current].slice(0, 20),
          );
        }
      }

      const state = await client.threads.getState(nextThreadId);
      const valuesPayload = state.values ?? state;
      setFinalState(valuesPayload);
      const fallbackText = extractLatestMessageText(valuesPayload);
      if (!tokenText && fallbackText) setTokenText(fallbackText);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }
  return {
    mode,
    setMode,
    prompt,
    setPrompt,
    threadId,
    status,
    tokenText,
    updates,
    values,
    customEvents,
    finalState,
    events,
    error,
    busy,
    resetView,
    runStream,
  };
}
