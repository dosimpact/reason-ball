import { isArray, isEmpty, isPlainObject, isString } from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import {
  type AttemptRecord,
  type ImprovementSuggestion,
  type JsonRecord,
  normalizeAttempts,
  normalizeSuggestions,
  normalizeToolCalls,
  normalizeTraceEvents,
  normalizeVerifications,
  sampleTasks,
  type ToolCallRecord,
  type TraceEvent,
  type TriggerType,
  type VerificationRecord,
} from "./model";

// Local state, derived values, and synchronous state transitions.
export function useLoopEngineeringHarnessState() {
  const [task, setTask] = useState(sampleTasks[0]);
  const [triggerType, setTriggerType] = useState<TriggerType>("webhook");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [qualityThreshold, setQualityThreshold] = useState(4);
  const [status, setStatus] = useState("Idle");
  const [threadId, setThreadId] = useState("");
  const [activeLoop, setActiveLoop] = useState("");
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [stopReason, setStopReason] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const latestVerification = verifications.at(-1);

  function resetView() {
    setStatus("Idle");
    setThreadId("");
    setActiveLoop("");
    setAttempts([]);
    setToolCalls([]);
    setVerifications([]);
    setTraceEvents([]);
    setSuggestions([]);
    setFinalAnswer("");
    setStopReason("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (isArray(values.attempts)) setAttempts(normalizeAttempts(values.attempts));
    if (isArray(values.tool_calls)) setToolCalls(normalizeToolCalls(values.tool_calls));
    if (isArray(values.verification_results)) {
      setVerifications(normalizeVerifications(values.verification_results));
    }
    if (isArray(values.trace_events)) setTraceEvents(normalizeTraceEvents(values.trace_events));
    if (isArray(values.improvement_suggestions)) {
      setSuggestions(normalizeSuggestions(values.improvement_suggestions));
    }
    if (isString(values.final_answer)) setFinalAnswer(values.final_answer);
    if (isString(values.stop_reason)) setStopReason(values.stop_reason);
    if (!isEmpty(values)) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isPlainObject(data) || data.type !== "loop_engineering_event") return;
    const event = normalizeTraceEvents([data])[0];
    setActiveLoop(event.loop);
    setTraceEvents((current) => [...current, event]);
  }

  function startRun() {
    setBusy(true);
    resetView();
    setStatus("Creating harness thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setStatus("Run failed");
  }

  return {
    task,
    setTask,
    triggerType,
    setTriggerType,
    maxAttempts,
    setMaxAttempts,
    qualityThreshold,
    setQualityThreshold,
    status,
    setStatus,
    threadId,
    setThreadId,
    activeLoop,
    attempts,
    toolCalls,
    verifications,
    traceEvents,
    suggestions,
    finalAnswer,
    stopReason,
    finalState,
    events,
    setEvents,
    error,
    busy,
    setBusy,
    latestVerification,
    resetView,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  };
}
