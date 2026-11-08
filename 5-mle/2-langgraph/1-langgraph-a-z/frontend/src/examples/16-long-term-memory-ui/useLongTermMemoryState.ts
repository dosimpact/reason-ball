import { isPlainObject, isArray, isString } from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import {
  samples,
  type JsonRecord,
  type MemoryAction,
  type MemoryRecord,
  type MemoryOperation,
  type MemoryEvent,
  normalizeStringList,
  normalizeMemories,
  normalizeOperations,
  normalizeMemoryEvents,
  mergeOperations,
  mergeMemoryEvents,
} from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useLongTermMemoryState() {
  const [userId, setUserId] = useState("learner-001");
  const [memoryId, setMemoryId] = useState(samples[0].key);
  const [content, setContent] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [lastMutationThreadId, setLastMutationThreadId] = useState("");
  const [crossThreadId, setCrossThreadId] = useState("");
  const [otherUserThreadId, setOtherUserThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [operations, setOperations] = useState<MemoryOperation[]>([]);
  const [memoryEvents, setMemoryEvents] = useState<MemoryEvent[]>([]);
  const [threadNotes, setThreadNotes] = useState<string[]>([]);
  const [namespace, setNamespace] = useState<string[]>([]);
  const [assistantResponse, setAssistantResponse] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [proofMessage, setProofMessage] = useState(
    "Create a memory, then recall it in a new thread.",
  );
  const [proofMemories, setProofMemories] = useState<MemoryRecord[]>([]);
  const [otherUserMemoryCount, setOtherUserMemoryCount] = useState<
    number | null
  >(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedMemory =
    memories.find((memory) => memory.id === memoryId) ?? null;

  const latestOperation = operations.at(-1) ?? null;

  function resetView() {
    setThreadId("");
    setLastMutationThreadId("");
    setCrossThreadId("");
    setOtherUserThreadId("");
    setStatus("Idle");
    setMemories([]);
    setOperations([]);
    setMemoryEvents([]);
    setThreadNotes([]);
    setNamespace([]);
    setAssistantResponse("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setProofMessage("Create a memory, then recall it in a new thread.");
    setProofMemories([]);
    setOtherUserMemoryCount(null);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (isArray(values.memories)) {
      setMemories(normalizeMemories(values.memories));
    }
    if (isArray(values.memory_operations)) {
      setOperations((current) =>
        mergeOperations(current, normalizeOperations(values.memory_operations)),
      );
    }
    if (isArray(values.memory_events)) {
      setMemoryEvents((current) =>
        mergeMemoryEvents(current, normalizeMemoryEvents(values.memory_events)),
      );
    }
    if (isArray(values.thread_notes)) {
      setThreadNotes(normalizeStringList(values.thread_notes));
    }
    if (isArray(values.namespace)) {
      setNamespace(normalizeStringList(values.namespace));
    }
    if (isString(values.assistant_response)) {
      setAssistantResponse(values.assistant_response);
    }
    if (isString(values.final)) {
      setFinal(values.final);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!isPlainObject(data) || data.type !== "memory_operation") return;
    const event = normalizeMemoryEvents([data])[0];
    setMemoryEvents((current) => mergeMemoryEvents(current, [event]));
  }

  function selectMemory(memory: MemoryRecord) {
    setMemoryId(memory.id);
    setContent(memory.content);
  }

  function prepareRunMemoryAction(action: MemoryAction) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(`Preparing ${action}`);
  }

  return {
    userId,
    setUserId,
    memoryId,
    setMemoryId,
    content,
    setContent,
    threadId,
    setThreadId,
    lastMutationThreadId,
    setLastMutationThreadId,
    crossThreadId,
    setCrossThreadId,
    otherUserThreadId,
    setOtherUserThreadId,
    status,
    setStatus,
    memories,
    memoryEvents,
    threadNotes,
    namespace,
    assistantResponse,
    final,
    finalState,
    events,
    setEvents,
    proofMessage,
    setProofMessage,
    proofMemories,
    setProofMemories,
    otherUserMemoryCount,
    setOtherUserMemoryCount,
    error,
    setError,
    busy,
    setBusy,
    latestOperation,
    resetView,
    applyValues,
    applyCustomEvent,
    selectMemory,
    prepareRunMemoryAction,
  };
}
