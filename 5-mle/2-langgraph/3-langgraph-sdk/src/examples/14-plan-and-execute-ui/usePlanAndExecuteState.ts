import { isPlainObject, isArray, isString, isNumber, isBoolean } from "remeda";
import { useMemo, useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import {
  samples,
  type ControlMode,
  type JsonRecord,
  type PlanStep,
  type StepEvent,
  normalizeSteps,
  normalizeEvents,
  updateStepFromEvent,
} from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function usePlanAndExecuteState() {
  const [task, setTask] = useState(samples[0].value);
  const [controlMode, setControlMode] = useState<ControlMode>("normal");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [executionStatus, setExecutionStatus] = useState("idle");
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const [completedSteps, setCompletedSteps] = useState<PlanStep[]>([]);
  const [stepEvents, setStepEvents] = useState<StepEvent[]>([]);
  const [planVersion, setPlanVersion] = useState(0);
  const [replanned, setReplanned] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activeStep = useMemo(
    () => planSteps.find((step) => step.status === "active"),
    [planSteps],
  );

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setExecutionStatus("idle");
    setPlanSteps([]);
    setCompletedSteps([]);
    setStepEvents([]);
    setPlanVersion(0);
    setReplanned(false);
    setStopped(false);
    setStopReason("");
    setFinalAnswer("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (isString(values.execution_status)) {
      setExecutionStatus(values.execution_status);
    }
    if (isArray(values.plan_steps)) {
      setPlanSteps(normalizeSteps(values.plan_steps));
    }
    if (isArray(values.completed_steps)) {
      setCompletedSteps(normalizeSteps(values.completed_steps));
    }
    if (isArray(values.step_events)) {
      setStepEvents(normalizeEvents(values.step_events));
    }
    if (isNumber(values.plan_version)) {
      setPlanVersion(values.plan_version);
    }
    if (isBoolean(values.replanned)) {
      setReplanned(values.replanned);
    }
    if (isBoolean(values.stopped)) {
      setStopped(values.stopped);
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
    if (!isPlainObject(data) || data.type !== "plan_step") return;
    const event = normalizeEvents([data])[0];
    setStepEvents((current) => [event, ...current].slice(0, 40));
    setPlanSteps((current) => updateStepFromEvent(current, event));
  }

  function prepareRunPlan() {
    setBusy(true);
    setError("");
    setEvents([]);
    setExecutionStatus("idle");
    setPlanSteps([]);
    setCompletedSteps([]);
    setStepEvents([]);
    setPlanVersion(0);
    setReplanned(false);
    setStopped(false);
    setStopReason("");
    setFinalAnswer("");
    setFinalState(null);
    setStatus("Creating plan thread");
  }

  return {
    task,
    setTask,
    controlMode,
    setControlMode,
    threadId,
    setThreadId,
    status,
    setStatus,
    executionStatus,
    planSteps,
    completedSteps,
    stepEvents,
    planVersion,
    replanned,
    stopped,
    stopReason,
    finalAnswer,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    activeStep,
    resetView,
    applyValues,
    applyCustomEvent,
    prepareRunPlan,
  };
}
