import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { samples, type FailureMode, type JsonRecord, type RetryAttempt, type ErrorRecord, type RetryEvent, normalizeAttempts, normalizeErrors, normalizeRetryEvents, mergeRetryEvents } from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useRetryErrorDegradationState() {
  const [query, setQuery] = useState(samples[0].value);
  const [failureMode, setFailureMode] = useState<FailureMode>("flaky_success");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [retryStatus, setRetryStatus] = useState("idle");
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [attempts, setAttempts] = useState<RetryAttempt[]>([]);
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [retryEvents, setRetryEvents] = useState<RetryEvent[]>([]);
  const [primaryResult, setPrimaryResult] = useState("");
  const [fallbackResult, setFallbackResult] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const usedStrategy =
    finalStatus === "fallback_success"
      ? "fallback"
      : finalStatus === "failed"
        ? "none"
        : "primary";

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setRetryStatus("idle");
    setCurrentAttempt(0);
    setAttempts([]);
    setErrors([]);
    setRetryEvents([]);
    setPrimaryResult("");
    setFallbackResult("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.final_status))
      setFinalStatus(values.final_status);
    if (R.isString(values.retry_status))
      setRetryStatus(values.retry_status);
    if (typeof values.current_attempt === "number")
      setCurrentAttempt(values.current_attempt);
    if (R.isArray(values.attempts))
      setAttempts(normalizeAttempts(values.attempts));
    if (R.isArray(values.errors)) setErrors(normalizeErrors(values.errors));
    if (R.isArray(values.retry_events)) {
      setRetryEvents((current) =>
        mergeRetryEvents(current, normalizeRetryEvents(values.retry_events)),
      );
    }
    if (R.isString(values.primary_result))
      setPrimaryResult(values.primary_result);
    if (R.isString(values.fallback_result))
      setFallbackResult(values.fallback_result);
    if (R.isString(values.final)) setFinal(values.final);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "retry_status") return;
    const event = normalizeRetryEvents([data])[0];
    setRetryEvents((current) => mergeRetryEvents(current, [event]));
    setRetryStatus(event.status);
    setCurrentAttempt(event.attempt);
  }

  function prepareRunRetryDemo() {
    setBusy(true);
    setError("");
    setEvents([]);
    setFinalStatus("running");
    setRetryStatus("prepared");
    setCurrentAttempt(0);
    setAttempts([]);
    setErrors([]);
    setRetryEvents([]);
    setPrimaryResult("");
    setFallbackResult("");
    setFinal("");
    setFinalState(null);
    setStatus("Creating retry thread");
  }

  return {
    query,
    setQuery,
    failureMode,
    setFailureMode,
    maxAttempts,
    setMaxAttempts,
    fallbackEnabled,
    setFallbackEnabled,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    retryStatus,
    currentAttempt,
    attempts,
    errors,
    retryEvents,
    primaryResult,
    fallbackResult,
    final,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    usedStrategy,
    resetView,
    applyValues,
    applyCustomEvent,
    prepareRunRetryDemo,
  };
}
