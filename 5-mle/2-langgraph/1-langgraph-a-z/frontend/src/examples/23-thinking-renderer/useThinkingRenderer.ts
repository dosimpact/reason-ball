import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads } from "./data";
import { useThinkingRendererState } from "./useThinkingRendererState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useThinkingRenderer() {
  const state = useThinkingRendererState();
  const {
    question,
    setThreadId,
    setStatus,
    setFinalStatus,
    setEvents,
    setError,
    setBusy,
    applyValues,
    applyCustomEvent,
    prepareRunThinkingRenderer,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runThinkingRenderer() {
    const trimmed = question.trim();
    if (!trimmed) return;

    prepareRunThinkingRenderer();

    try {
      const thread = await client.threads.create({
        metadata: { example: "23-thinking-renderer" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming thinking status");
      const stream = await client.runs.stream(
        nextThreadId,
        "23_thinking_renderer",
        {
          input: { question: trimmed },
          streamMode: ["updates", "custom"] as ["updates", "custom"],
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 160));
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
      setFinalStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  return {
    question: state.question,
    setQuestion: state.setQuestion,
    threadId: state.threadId,
    runId: state.runId,
    status: state.status,
    finalStatus: state.finalStatus,
    thinkingSteps: state.thinkingSteps,
    reasoningSummary: state.reasoningSummary,
    safetyGuardrails: state.safetyGuardrails,
    answer: state.answer,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    completedSteps: state.completedSteps,
    resetView: state.resetView,
    runThinkingRenderer,
  };
}

export type ThinkingRendererController = ReturnType<typeof useThinkingRenderer>;
