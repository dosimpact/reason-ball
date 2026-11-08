import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads } from "./data";
import { useRagQaState } from "./useRagQaState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useRagQa() {
  const state = useRagQaState();
  const {
    question,
    setThreadId,
    setStatus,
    setEvents,
    setError,
    setBusy,
    applyValues,
    prepareRunRagQa,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runRagQa() {
    const trimmed = question.trim();
    if (!trimmed) return;

    prepareRunRagQa();

    try {
      const thread = await client.threads.create({
        metadata: { example: "13-rag-qa-ui", question: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming RAG QA");

      const stream = await client.runs.stream(nextThreadId, "13_rag_qa", {
        input: { question: trimmed },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 100));
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
    question: state.question,
    setQuestion: state.setQuestion,
    threadId: state.threadId,
    status: state.status,
    qaStatus: state.qaStatus,
    retrievedDocs: state.retrievedDocs,
    answer: state.answer,
    citations: state.citations,
    citationOk: state.citationOk,
    fallbackReason: state.fallbackReason,
    final: state.final,
    highlightedDocId: state.highlightedDocId,
    setHighlightedDocId: state.setHighlightedDocId,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    retrievedIds: state.retrievedIds,
    resetView: state.resetView,
    runRagQa,
  };
}

export type RagQaController = ReturnType<typeof useRagQa>;
