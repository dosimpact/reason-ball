import { countBy, filter, isArray, isEmpty } from "remeda";
import { useMemo, useState } from "react";
import { StreamLogEntry, createClientId } from "../../lib/langgraphClient";

import {
  type JsonRecord,
  type TodoItem,
  type ToolActivity,
  type TranscriptItem,
  contentToText,
  extractMessages,
  latestToolActivity,
  normalizeTodos,
  samplePrompts,
  toolArgsOf,
  toolCallIdOf,
  toolCallsFromMessage,
  toolNameOf,
  upsertToolActivity,
  upsertTranscript,
} from "./model";

// Local state, derived values, and synchronous state transitions.
export function useTodoListMiddlewareState() {
  const [prompt, setPrompt] = useState(samplePrompts[0]);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const counts = useMemo(
    () => {
      const byStatus = countBy(todos, (todo) => todo.status);
      return {
        pending: byStatus.pending ?? 0,
        inProgress: byStatus.in_progress ?? 0,
        completed: byStatus.completed ?? 0,
      };
    },
    [todos],
  );
  const middlewareErrors = filter(toolActivities, (activity) => activity.status === "error");

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setTodos([]);
    setTranscript([]);
    setToolActivities([]);
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyMessages(messages: JsonRecord[], receivedAt: string) {
    for (const message of messages) {
      const type = String(message.type ?? message.role ?? "").toLowerCase();
      const text = contentToText(message.content);

      if (type.includes("ai") || type === "assistant") {
        const calls = toolCallsFromMessage(message);
        if (calls.length > 0) {
          setToolActivities((current) =>
            calls.reduce((activities, call, index) => {
              const id = toolCallIdOf(call, `tool-${index}`);
              return upsertToolActivity(activities, {
                id,
                name: toolNameOf(call),
                args: toolArgsOf(call),
                status: "running",
                updatedAt: receivedAt,
              });
            }, current),
          );
        }

        if (text) {
          setTranscript((current) =>
            upsertTranscript(current, {
              id: String(message.id ?? createClientId("assistant")),
              role: "assistant",
              content: text,
            }),
          );
        }
      }

      if (type.includes("tool")) {
        const toolCallId = String(message.tool_call_id ?? message.id ?? "");
        const result = text || JSON.stringify(message.content ?? "");
        const isError = message.status === "error" || result.toLowerCase().startsWith("error");
        const isTodoUpdate = String(message.name ?? "").includes("write_todos")
          && result.startsWith("Updated todo list");

        if (isError || !isTodoUpdate) {
          setTranscript((current) =>
            upsertTranscript(current, {
              id: String((message.id ?? toolCallId) || createClientId("tool-message")),
              role: "tool",
              content: result,
            }),
          );
        }
        setToolActivities((current) => {
          const existing = latestToolActivity(current, toolCallId);
          return upsertToolActivity(current, {
            id: toolCallId || existing?.id || createClientId("tool"),
            name: String(message.name ?? existing?.name ?? "write_todos"),
            args: existing?.args,
            status: isError ? "error" : "success",
            result,
            updatedAt: receivedAt,
          });
        });
      }
    }
  }

  function applyValues(values: JsonRecord, source: string, receivedAt: string) {
    if (isArray(values.todos)) {
      const nextTodos = normalizeTodos(values.todos, source, receivedAt);
      setTodos(nextTodos);
      setTranscript((current) =>
        upsertTranscript(current, {
          id: "inline-todo-state",
          role: "todo",
          content: "Todo list",
          todos: nextTodos,
        }),
      );
    }
    if (isArray(values.messages)) {
      applyMessages(extractMessages(values.messages), receivedAt);
    }
    if (!isEmpty(values)) {
      setFinalState(values);
    }
  }

  function startRun(trimmed: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setTodos([]);
    setTranscript([{ id: createClientId("human"), role: "human", content: trimmed }]);
    setToolActivities([]);
    setFinalState(null);
    setStatus("Creating todo thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setStatus("Run failed");
  }

  return {
    prompt,
    setPrompt,
    threadId,
    setThreadId,
    status,
    setStatus,
    todos,
    transcript,
    toolActivities,
    finalState,
    events,
    setEvents,
    error,
    busy,
    setBusy,
    counts,
    middlewareErrors,
    resetView,
    applyMessages,
    applyValues,
    startRun,
    failRun,
  };
}
