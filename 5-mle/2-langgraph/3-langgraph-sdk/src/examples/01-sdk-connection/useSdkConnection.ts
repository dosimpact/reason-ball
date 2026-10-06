import { find } from "remeda";
import {
  assistantIdOf,
  createLangGraphClient,
  extractLatestMessageText,
  normalizeAssistants,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { useSdkConnectionState } from "./useSdkConnectionState";
const client = createLangGraphClient();
export function useSdkConnection() {
  const {
    prepareRunAssistant,
    assistants,
    setAssistants,
    selectedAssistantId,
    setSelectedAssistantId,
    threadId,
    setThreadId,
    prompt,
    setPrompt,
    runId,
    setRunId,
    status,
    setStatus,
    answer,
    setAnswer,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
  } = useSdkConnectionState();

  async function loadAssistants() {
    setBusy(true);
    setError("");
    setStatus("Loading assistants");
    try {
      const result = await client.assistants.search({ limit: 100 });

      const normalized = normalizeAssistants(result);
      setAssistants(normalized);
      const preferred =
        find(normalized,
          (assistant) =>
            assistant.graph_id === "01_sdk_connection" ||
            assistant.graphId === "01_sdk_connection" ||
            assistant.name === "01_sdk_connection",
        ) ?? normalized[0];
      if (preferred) {
        setSelectedAssistantId(
          preferred.graph_id ?? preferred.graphId ?? assistantIdOf(preferred),
        );
      }
      setStatus(
        `Loaded ${normalized.length} assistant${normalized.length === 1 ? "" : "s"}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Assistant load failed");
    } finally {
      setBusy(false);
    }
  }

  async function createThread() {
    setBusy(true);
    setError("");
    setStatus("Creating thread");
    try {
      const thread = await client.threads.create();
      const nextThreadId = thread.thread_id;

      setThreadId(nextThreadId);
      setEvents([]);
      setAnswer("");
      setRunId("");
      setStatus("Thread ready");
      return nextThreadId;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Thread create failed");
      return "";
    } finally {
      setBusy(false);
    }
  }

  async function deleteThread() {
    if (!threadId) return;
    setBusy(true);
    setError("");
    setStatus("Deleting thread");
    try {
      await client.threads.delete(threadId);
      setThreadId("");
      setRunId("");
      setEvents([]);
      setAnswer("");
      setStatus("Thread deleted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Thread delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAssistant() {
    prepareRunAssistant();

    try {
      const activeThreadId = threadId || (await createThread());
      if (!activeThreadId)
        throw new Error("Unable to create or reuse a thread.");

      const stream = await client.runs.stream(
        activeThreadId,
        selectedAssistantId,
        {
          input: {
            messages: [{ type: "human", content: prompt }],
          },
          streamMode: "updates",
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 80));
        if (logEntry.runId) setRunId(logEntry.runId);

        const text = extractLatestMessageText(logEntry.data);
        if (text) setAnswer(text);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }
  return {
    assistants,
    selectedAssistantId,
    setSelectedAssistantId,
    threadId,
    prompt,
    setPrompt,
    runId,
    status,
    answer,
    events,
    error,
    busy,
    loadAssistants,
    createThread,
    deleteThread,
    runAssistant,
  };
}
