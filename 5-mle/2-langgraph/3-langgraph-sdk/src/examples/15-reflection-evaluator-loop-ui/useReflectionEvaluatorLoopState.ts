import { isPlainObject, isArray, isString, isNumber } from "remeda";
import { useMemo, useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import {
  samples,
  type RetryPolicy,
  type JsonRecord,
  type Verdict,
  type IterationRecord,
  type LoopEvent,
  normalizeStringList,
  normalizeIterations,
  normalizeLoopEvents,
} from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useReflectionEvaluatorLoopState() {
  const [request, setRequest] = useState(samples[0].value);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [retryPolicy, setRetryPolicy] =
    useState<RetryPolicy>("force_first_retry");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [loopStatus, setLoopStatus] = useState("idle");
  const [currentIteration, setCurrentIteration] = useState(0);
  const [iterations, setIterations] = useState<IterationRecord[]>([]);
  const [loopEvents, setLoopEvents] = useState<LoopEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [requiredChanges, setRequiredChanges] = useState<string[]>([]);
  const [stopReason, setStopReason] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const rejectedIterations = useMemo(
    () => iterations.filter((iteration) => iteration.verdict === "FAIL"),
    [iterations],
  );

  const acceptedIteration = useMemo(
    () =>
      iterations.find((iteration) => iteration.verdict === "PASS") ??
      iterations.at(-1),
    [iterations],
  );

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setLoopStatus("idle");
    setCurrentIteration(0);
    setIterations([]);
    setLoopEvents([]);
    setDraft("");
    setVerdict("");
    setScore(0);
    setFeedback("");
    setRequiredChanges([]);
    setStopReason("");
    setFinalAnswer("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (isString(values.loop_status)) {
      setLoopStatus(values.loop_status);
    }
    if (isNumber(values.current_iteration)) {
      setCurrentIteration(values.current_iteration);
    }
    if (isArray(values.iterations)) {
      setIterations(normalizeIterations(values.iterations));
    }
    if (isArray(values.loop_events)) {
      setLoopEvents(normalizeLoopEvents(values.loop_events));
    }
    if (isString(values.draft)) {
      setDraft(values.draft);
    }
    if (values.verdict === "PASS" || values.verdict === "FAIL") {
      setVerdict(values.verdict);
    }
    if (isNumber(values.score)) {
      setScore(values.score);
    }
    if (isString(values.feedback)) {
      setFeedback(values.feedback);
    }
    if (isArray(values.required_changes)) {
      setRequiredChanges(normalizeStringList(values.required_changes));
    }
    if (isString(values.stop_reason)) {
      setStopReason(values.stop_reason);
    }
    if (isString(values.final_answer)) {
      setFinalAnswer(values.final_answer);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!isPlainObject(data) || data.type !== "reflection_iteration") return;
    const event = normalizeLoopEvents([data])[0];
    setLoopEvents((current) => [event, ...current].slice(0, 50));
    if (event.phase) {
      setLoopStatus(event.phase);
    }
    if (event.iteration) {
      setCurrentIteration(event.iteration);
    }
  }

  function prepareRunLoop() {
    setBusy(true);
    setError("");
    setEvents([]);
    setLoopStatus("idle");
    setCurrentIteration(0);
    setIterations([]);
    setLoopEvents([]);
    setDraft("");
    setVerdict("");
    setScore(0);
    setFeedback("");
    setRequiredChanges([]);
    setStopReason("");
    setFinalAnswer("");
    setFinalState(null);
    setStatus("Creating reflection thread");
  }

  return {
    request,
    setRequest,
    maxAttempts,
    setMaxAttempts,
    retryPolicy,
    setRetryPolicy,
    threadId,
    setThreadId,
    status,
    setStatus,
    loopStatus,
    currentIteration,
    iterations,
    loopEvents,
    draft,
    verdict,
    score,
    feedback,
    requiredChanges,
    stopReason,
    finalAnswer,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    rejectedIterations,
    acceptedIteration,
    resetView,
    applyValues,
    applyCustomEvent,
    prepareRunLoop,
  };
}
