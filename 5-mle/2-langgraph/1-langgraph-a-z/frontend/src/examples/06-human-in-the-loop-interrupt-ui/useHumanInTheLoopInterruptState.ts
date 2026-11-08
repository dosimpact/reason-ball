import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { InterruptPayload, defaultAction, editedAction } from "./data";
import { clearPendingThread } from "./pendingThreadStorage";

// Local state is separate from SDK requests and rendering.
export function useHumanInTheLoopInterruptState() {
  const [action, setAction] = useState(defaultAction);
  const [editText, setEditText] = useState(editedAction);
  const [threadId, setThreadId] = useState("");
  const [pendingThreadId, setPendingThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [interruptPayload, setInterruptPayload] =
    useState<InterruptPayload | null>(null);
  const [finalState, setFinalState] = useState<Record<string, unknown> | null>(
    null,
  );
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    clearPendingThread();
    setPendingThreadId("");
    setThreadId("");
    setStatus("Idle");
    setInterruptPayload(null);
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function prepareStartRun() {
    setBusy(true);
    setError("");
    setEvents([]);
    setInterruptPayload(null);
    setFinalState(null);
    setStatus("Creating approval thread");
  }

  return {
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
  };
}
