import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads } from "./data";
import { useChatCitationRendererState } from "./useChatCitationRendererState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useChatCitationRenderer() {
  const state = useChatCitationRendererState();
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
    prepareRunCitationRenderer,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runCitationRenderer() {
    const trimmed = question.trim();
    if (!trimmed) return;

    prepareRunCitationRenderer();

    try {
      const thread = await client.threads.create({
        metadata: { example: "24-chat-citation-renderer" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming citation renderer");
      const stream = await client.runs.stream(
        nextThreadId,
        "24_chat_citation_renderer",
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
    status: state.status,
    finalStatus: state.finalStatus,
    sources: state.sources,
    answerSegments: state.answerSegments,
    citations: state.citations,
    selectedCitationId: state.selectedCitationId,
    setSelectedCitationId: state.setSelectedCitationId,
    answer: state.answer,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    selectedCitation: state.selectedCitation,
    selectedSource: state.selectedSource,
    resetView: state.resetView,
    runCitationRenderer,
  };
}

export type ChatCitationRendererController = ReturnType<
  typeof useChatCitationRenderer
>;
