import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { defaultAction, editedAction } from "./data";

// Local state is separate from SDK requests and rendering.
export function useHumanInTheLoopReactHookState() {
  const [action, setAction] = useState(defaultAction);
  const [editText, setEditText] = useState(editedAction);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [status, setStatus] = useState("Idle");
  return {
    action,
    setAction,
    editText,
    setEditText,
    threadId,
    setThreadId,
    events,
    setEvents,
    status,
    setStatus,
  };
}
