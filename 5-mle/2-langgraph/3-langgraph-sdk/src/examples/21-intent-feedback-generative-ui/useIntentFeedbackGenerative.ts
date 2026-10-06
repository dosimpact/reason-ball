import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { type JsonRecord, valuesOf, nodePayloads } from "./data";
import { useIntentFeedbackGenerativeState } from "./useIntentFeedbackGenerativeState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useIntentFeedbackGenerative() {
  const state = useIntentFeedbackGenerativeState();
  const {
    userQuery,
    setThreadId,
    setStatus,
    selection,
    setEvents,
    setError,
    setBusy,
    selectionComplete,
    applyValues,
    applyCustomEvent,
    prepareRunIntent,
    prepareRunIntentCheck,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runIntent(input: JsonRecord, label: string) {
    prepareRunIntent(label);

    try {
      const thread = await client.threads.create({
        metadata: { example: "21-intent-feedback-generative-ui", label },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus(`Streaming ${label}`);
      const stream = await client.runs.stream(
        nextThreadId,
        "21_intent_feedback_generative_ui",
        {
          input,
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

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function runIntentCheck() {
    const query = userQuery.trim();
    if (!query) return;
    prepareRunIntentCheck();
    await runIntent({ user_query: query }, "intent check");
  }

  async function continueWithSelections() {
    if (!selectionComplete) return;
    await runIntent(
      {
        user_query: userQuery,
        selection,
      },
      "selection continuation",
    );
  }

  return {
    userQuery: state.userQuery,
    setUserQuery: state.setUserQuery,
    threadId: state.threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    intent: state.intent,
    missing: state.missing,
    uiRequests: state.uiRequests,
    selection: state.selection,
    quoteSnapshot: state.quoteSnapshot,
    answer: state.answer,
    final: state.final,
    intentEvents: state.intentEvents,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    selectionComplete: state.selectionComplete,
    resetView: state.resetView,
    selectOption: state.selectOption,
    runIntentCheck,
    continueWithSelections,
  };
}

export type IntentFeedbackGenerativeController = ReturnType<
  typeof useIntentFeedbackGenerative
>;
