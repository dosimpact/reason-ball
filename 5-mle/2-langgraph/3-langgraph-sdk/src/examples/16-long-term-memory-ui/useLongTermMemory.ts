import { isArray } from "remeda";
import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import {
  type MemoryAction,
  valuesOf,
  nodePayloads,
  normalizeMemories,
} from "./data";
import { useLongTermMemoryState } from "./useLongTermMemoryState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function useLongTermMemory() {
  const state = useLongTermMemoryState();
  const {
    userId,
    memoryId,
    content,
    threadId,
    setThreadId,
    setLastMutationThreadId,
    setCrossThreadId,
    setOtherUserThreadId,
    setStatus,
    memories,
    setEvents,
    setProofMessage,
    setProofMemories,
    setOtherUserMemoryCount,
    setError,
    setBusy,
    applyValues,
    applyCustomEvent,
    prepareRunMemoryAction,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runMemoryAction(
    action: MemoryAction,
    options: {
      newThread?: boolean;
      overrideUserId?: string;
      overrideThreadLabel?: string;
      trackProof?: boolean;
      trackOtherUser?: boolean;
    } = {},
  ) {
    const activeUserId = (options.overrideUserId ?? userId).trim();
    const activeMemoryId = memoryId.trim();
    const activeContent = content.trim();
    if (!activeUserId) return;
    if (
      (action === "create" || action === "update") &&
      (!activeMemoryId || !activeContent)
    )
      return;
    if (action === "delete" && !activeMemoryId) return;

    prepareRunMemoryAction(action);

    try {
      let activeThreadId = threadId;
      if (options.newThread || !activeThreadId) {
        const thread = await client.threads.create({
          metadata: {
            example: "16-long-term-memory-ui",
            userId: activeUserId,
            action,
          },
        });
        activeThreadId = String(thread.thread_id);
      }

      setThreadId(activeThreadId);
      if (action !== "recall") {
        setLastMutationThreadId(activeThreadId);
      }
      if (options.trackProof) {
        setCrossThreadId(activeThreadId);
      }
      if (options.trackOtherUser) {
        setOtherUserThreadId(activeThreadId);
      }

      setStatus(`Streaming ${action}`);
      const stream = await client.runs.stream(
        activeThreadId,
        "16_long_term_memory",
        {
          input: {
            user_id: activeUserId,
            action,
            memory_id: activeMemoryId,
            content: action === "delete" ? "" : activeContent,
            thread_label:
              options.overrideThreadLabel ??
              (options.newThread ? "New thread recall" : "Primary thread"),
          },
          streamMode: ["updates", "custom"] as ["updates", "custom"],
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 120));
        if (logEntry.event === "custom") {
          applyCustomEvent(logEntry.data);
        }
        for (const payload of nodePayloads(logEntry.data)) {
          applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(activeThreadId);
      const values = valuesOf(state);
      applyValues(values);
      const memoryCount = isArray(values.memories)
        ? values.memories.length
        : 0;
      if (options.trackProof) {
        setProofMemories(normalizeMemories(values.memories));
        setProofMessage(
          `New thread ${activeThreadId} recalled ${memoryCount} durable memories for ${activeUserId}.`,
        );
      }
      if (options.trackOtherUser) {
        setProofMemories(normalizeMemories(values.memories));
        setProofMessage(
          `Other user ${activeUserId} returned ${memoryCount} durable memories.`,
        );
        setOtherUserMemoryCount(memoryCount);
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
    userId: state.userId,
    setUserId: state.setUserId,
    memoryId: state.memoryId,
    setMemoryId: state.setMemoryId,
    content: state.content,
    setContent: state.setContent,
    threadId: state.threadId,
    lastMutationThreadId: state.lastMutationThreadId,
    crossThreadId: state.crossThreadId,
    otherUserThreadId: state.otherUserThreadId,
    status: state.status,
    memories: state.memories,
    memoryEvents: state.memoryEvents,
    threadNotes: state.threadNotes,
    namespace: state.namespace,
    assistantResponse: state.assistantResponse,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    proofMessage: state.proofMessage,
    proofMemories: state.proofMemories,
    otherUserMemoryCount: state.otherUserMemoryCount,
    error: state.error,
    busy: state.busy,
    latestOperation: state.latestOperation,
    resetView: state.resetView,
    selectMemory: state.selectMemory,
    runMemoryAction,
  };
}

export type LongTermMemoryController = ReturnType<typeof useLongTermMemory>;
