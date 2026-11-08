import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { analysisPrompt, type JsonRecord, type ThinkingStep, type SafetyGuardrails, normalizeThinkingStep, normalizeThinkingSteps, normalizeGuardrails, mergeThinkingSteps } from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useThinkingRendererState() {
  const [question, setQuestion] = useState(analysisPrompt);
  const [threadId, setThreadId] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [reasoningSummary, setReasoningSummary] = useState("");
  const [safetyGuardrails, setSafetyGuardrails] =
    useState<SafetyGuardrails | null>(null);
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const completedSteps = thinkingSteps.filter(
    (step) => step.status === "completed",
  ).length;

  function resetView() {
    setThreadId("");
    setRunId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setThinkingSteps([]);
    setReasoningSummary("");
    setSafetyGuardrails(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyThinkingSteps(next: ThinkingStep[]) {
    setThinkingSteps((current) => mergeThinkingSteps(current, next));
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.run_id)) setRunId(values.run_id);
    if (R.isString(values.final_status))
      setFinalStatus(values.final_status);
    if (R.isArray(values.thinking_steps))
      applyThinkingSteps(normalizeThinkingSteps(values.thinking_steps));
    if (R.isString(values.reasoning_summary))
      setReasoningSummary(values.reasoning_summary);
    if (R.isPlainObject(values.safety_guardrails))
      setSafetyGuardrails(normalizeGuardrails(values.safety_guardrails));
    if (R.isString(values.answer)) setAnswer(values.answer);
    if (R.isString(values.final)) setFinal(values.final);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    const step = normalizeThinkingStep(data);
    if (step) applyThinkingSteps([step]);
  }

  function prepareRunThinkingRenderer() {
    setBusy(true);
    setError("");
    setEvents([]);
    setThinkingSteps([]);
    setReasoningSummary("");
    setSafetyGuardrails(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setFinalStatus("running");
    setStatus("Creating thinking thread");
  }

  return {
    question,
    setQuestion,
    threadId,
    setThreadId,
    runId,
    status,
    setStatus,
    finalStatus,
    setFinalStatus,
    thinkingSteps,
    reasoningSummary,
    safetyGuardrails,
    answer,
    final,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    completedSteps,
    resetView,
    applyValues,
    applyCustomEvent,
    prepareRunThinkingRenderer,
  };
}
