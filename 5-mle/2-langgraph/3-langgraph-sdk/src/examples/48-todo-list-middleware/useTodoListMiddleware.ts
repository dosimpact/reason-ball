import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { extractMessages, nodePayloads, valuesOf } from "./model";

import { useTodoListMiddlewareState } from "./useTodoListMiddlewareState";

// SDK requests, browser input preparation, and stream consumption.
export function useTodoListMiddleware() {
  const state = useTodoListMiddlewareState();
  const {
    prompt,
    setThreadId,
    setStatus,
    setEvents,
    setBusy,
    applyMessages,
    applyValues,
    startRun,
    failRun,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runTodoList() {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    startRun(trimmed);

    try {
      const thread = await client.threads.create({
        metadata: { example: "48-todo-list-middleware" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming todo middleware");

      const stream = await client.runs.stream(nextThreadId, "48_todo_list_middleware", {
        input: { messages: [{ type: "human", content: trimmed }] },
        streamMode: ["updates", "values"] as ["updates", "values"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 140));

        if (logEntry.event === "values") {
          applyValues(valuesOf(logEntry.data), "values", logEntry.receivedAt);
        }
        if (logEntry.event === "updates") {
          for (const payload of nodePayloads(logEntry.data)) {
            applyValues(payload, "updates", logEntry.receivedAt);
          }
          applyMessages(extractMessages(logEntry.data), logEntry.receivedAt);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state), "final state", new Date().toLocaleTimeString());
      setStatus("Run complete");
    } catch (caught) {
      failRun(caught);
    } finally {
      setBusy(false);
    }
  }

  return {
    prompt,
    setPrompt: state.setPrompt,
    threadId: state.threadId,
    status: state.status,
    todos: state.todos,
    transcript: state.transcript,
    toolActivities: state.toolActivities,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    counts: state.counts,
    middlewareErrors: state.middlewareErrors,
    resetView: state.resetView,
    runTodoList,
  };
}
