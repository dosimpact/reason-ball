import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads } from "./data";
import { useLongContextState } from "./useLongContextState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useLongContext() {
  const state = useLongContextState();
  const {
    threadId,
    setThreadId,
    setStatus,
    messages,
    followUp,
    setEvents,
    setError,
    setBusy,
    resetState,
    applyValues,
    applyCustomEvent,
    prepareReloadState,
    prepareRunMessages,
    prepareCreateThread,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function ensureThread(label: string) {
    if (threadId) return threadId;
    const thread = await client.threads.create({
      metadata: { example: "19-long-context-ui", label },
    });
    const nextThreadId = String(thread.thread_id);
    setThreadId(nextThreadId);
    return nextThreadId;
  }

  async function reloadState() {
    if (!threadId) return;
    prepareReloadState();
    try {
      const state = await client.threads.getState(threadId);
      applyValues(valuesOf(state));
      setStatus("Context state loaded");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("State load failed");
    } finally {
      setBusy(false);
    }
  }

  async function runMessages(inputMessages: string[], label: string) {
    prepareRunMessages(label);

    try {
      const activeThreadId =
        label === "seed conversation"
          ? String(
              (
                await client.threads.create({
                  metadata: { example: "19-long-context-ui", label },
                })
              ).thread_id,
            )
          : await ensureThread(label);
      setThreadId(activeThreadId);
      setStatus(`Streaming ${label}`);

      const stream = await client.runs.stream(
        activeThreadId,
        "19_long_context",
        {
          input: {
            messages: inputMessages.map((content) => ({
              type: "human",
              content,
            })),
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

      const state = await client.threads.getState(activeThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function createThread() {
    prepareCreateThread();
    try {
      const thread = await client.threads.create({
        metadata: { example: "19-long-context-ui", label: "manual" },
      });
      resetState();
      setThreadId(String(thread.thread_id));
      setStatus("Context thread ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Thread create failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendFollowUp() {
    const trimmed = followUp.trim();
    if (!trimmed) return;
    await runMessages([trimmed], "follow-up message");
  }

  return {
    threadId: state.threadId,
    status: state.status,
    messages: state.messages,
    summary: state.summary,
    summaryMetadata: state.summaryMetadata,
    summaryRecords: state.summaryRecords,
    summarizedMessages: state.summarizedMessages,
    contextEvents: state.contextEvents,
    contextStats: state.contextStats,
    assistantResponse: state.assistantResponse,
    final: state.final,
    lastCompactionRunId: state.lastCompactionRunId,
    followUp: state.followUp,
    setFollowUp: state.setFollowUp,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    resetState: state.resetState,
    latestRecord: state.latestRecord,
    reloadState,
    runMessages,
    createThread,
    sendFollowUp,
  };
}

export type LongContextController = ReturnType<typeof useLongContext>;
