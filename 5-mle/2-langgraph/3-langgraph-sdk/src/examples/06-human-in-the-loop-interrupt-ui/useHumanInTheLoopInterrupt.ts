import { useEffect, useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { extractInterruptPayload, valuesOf } from "./data";
import {
  clearPendingThread,
  readPendingThread,
  writePendingThread,
} from "./pendingThreadStorage";
import { useHumanInTheLoopInterruptState } from "./useHumanInTheLoopInterruptState";

export function useHumanInTheLoopInterrupt() {
  const {
    prepareStartRun,
    action,
    setAction,
    editText,
    setEditText,
    threadId,
    setThreadId,
    pendingThreadId,
    setPendingThreadId,
    status,
    setStatus,
    interruptPayload,
    setInterruptPayload,
    finalState,
    setFinalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  } = useHumanInTheLoopInterruptState();

  const client = useMemo(() => createLangGraphClient(), []);

  useEffect(() => {
    const storedThreadId = readPendingThread();
    setPendingThreadId(storedThreadId);
    if (storedThreadId) {
      void recoverPendingInterrupt(storedThreadId);
    }
  }, []);

  async function refreshInterruptState(activeThreadId: string) {
    const state = await client.threads.getState(activeThreadId);
    const payload = extractInterruptPayload(state);
    const values = valuesOf(state);
    setFinalState(values);

    if (payload) {
      setInterruptPayload(payload);
      setStatus("Interrupted");
      writePendingThread(activeThreadId);
      setPendingThreadId(activeThreadId);
      return true;
    }

    setInterruptPayload(null);
    if (values.execution_result || values.final) {
      setStatus("Run complete");
      clearPendingThread();
      setPendingThreadId("");
    }
    return false;
  }

  async function startRun() {
    const trimmed = action.trim();
    if (!trimmed) return;

    prepareStartRun();

    try {
      const thread = await client.threads.create({
        metadata: { example: "06-human-in-the-loop-interrupt-ui" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      writePendingThread(nextThreadId);
      setPendingThreadId(nextThreadId);
      setStatus("Running until approval interrupt");

      const stream = await client.runs.stream(
        nextThreadId,
        "06_human_in_the_loop_interrupt",
        {
          input: { action: trimmed },
          streamMode: "updates",
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);

        console.log(">>logEntry", logEntry);

        setEvents((current) => [logEntry, ...current].slice(0, 80));
        const maybeInterrupt = extractInterruptPayload(logEntry.data);
        if (maybeInterrupt) setInterruptPayload(maybeInterrupt);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const interrupted = await refreshInterruptState(nextThreadId);
      if (!interrupted) setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function recoverPendingInterrupt(overrideThreadId?: string) {
    const storedThreadId =
      overrideThreadId || pendingThreadId || readPendingThread();
    if (!storedThreadId) return;
    setBusy(true);
    setError("");
    setThreadId(storedThreadId);
    setStatus("Recovering pending interrupt");
    try {
      const interrupted = await refreshInterruptState(storedThreadId);
      if (!interrupted) setStatus("No pending interrupt");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Recovery failed");
    } finally {
      setBusy(false);
    }
  }

  async function resumeRun(resumeValue: unknown) {
    if (!threadId) return;
    setBusy(true);
    setError("");
    setStatus("Resuming approval run");

    try {
      const stream = await client.runs.stream(
        threadId,
        "06_human_in_the_loop_interrupt",
        {
          input: null,
          command: { resume: resumeValue },
          streamMode: "updates",
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 80));
        setStatus(`Streaming: ${logEntry.event}`);
      }

      await refreshInterruptState(threadId);
      setStatus("Run complete");
      setInterruptPayload(null);
      clearPendingThread();
      setPendingThreadId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Resume failed");
    } finally {
      setBusy(false);
    }
  }

  const resultText = String(
    finalState?.final ?? finalState?.execution_result ?? "",
  );
  return {
    action,
    setAction,
    editText,
    setEditText,
    threadId,
    pendingThreadId,
    status,
    interruptPayload,
    finalState,
    events,
    error,
    busy,
    resetView,
    startRun,
    recoverPendingInterrupt,
    resumeRun,
    resultText,
  };
}
