import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import { defaultGoal, mergePlanEvents, normalizeLog, normalizePlanEvents, normalizeSteps, normalizeVersions, type ExecutionLog, type JsonRecord, type PlanEvent, type PlanStatus, type PlanStep, type PlanVersion } from "./model";

// Local state, derived values, and synchronous state transitions.
export function useChatPlanBoardState() {
  const [userGoal, setUserGoal] = useState(defaultGoal);
  const [revisionNote, setRevisionNote] = useState("Add a reviewer checkpoint before final launch.");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [planTitle, setPlanTitle] = useState("Execution Plan Board");
  const [planSummary, setPlanSummary] = useState("");
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const [activeStepId, setActiveStepId] = useState("");
  const [boardStatus, setBoardStatus] = useState("idle");
  const [executionLog, setExecutionLog] = useState<ExecutionLog[]>([]);
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [versionHistory, setVersionHistory] = useState<PlanVersion[]>([]);
  const [planEvents, setPlanEvents] = useState<PlanEvent[]>([]);
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggingStepId, setDraggingStepId] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState<PlanStatus | "">("");
  const [boardEditStatus, setBoardEditStatus] = useState("No manual board moves yet.");
  const canEditBoard = Boolean(threadId) && planSteps.length > 0 && !busy;
  const canContinue = canEditBoard;

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setPlanTitle("Execution Plan Board");
    setPlanSummary("");
    setPlanSteps([]);
    setActiveStepId("");
    setBoardStatus("idle");
    setExecutionLog([]);
    setArtifactVersion(0);
    setVersionHistory([]);
    setPlanEvents([]);
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
    setDraggingStepId("");
    setDragOverStatus("");
    setBoardEditStatus("No manual board moves yet.");
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.plan_title)) setPlanTitle(values.plan_title);
    if (R.isString(values.plan_summary)) setPlanSummary(values.plan_summary);
    if (R.isArray(values.plan_steps)) setPlanSteps(normalizeSteps(values.plan_steps));
    if (R.isString(values.active_step_id)) setActiveStepId(values.active_step_id);
    if (R.isString(values.board_status)) setBoardStatus(values.board_status);
    if (R.isArray(values.execution_log)) setExecutionLog(normalizeLog(values.execution_log));
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (R.isArray(values.version_history)) setVersionHistory(normalizeVersions(values.version_history));
    if (R.isArray(values.plan_events)) {
      setPlanEvents((current) => mergePlanEvents(current, normalizePlanEvents(values.plan_events)));
    }
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status)) setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "31_chat_plan_board") return;
    setPlanEvents((current) => mergePlanEvents(current, normalizePlanEvents([data])));
  }

  function handleCardDragEnd() {
    setDraggingStepId("");
    setDragOverStatus("");
  }

  function startRun(reuseThreadId: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming plan update" : "Creating plan board thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setFinalStatus("failed");
    setStatus("Run failed");
  }

  return {
    userGoal,
    setUserGoal,
    revisionNote,
    setRevisionNote,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    setFinalStatus,
    planTitle,
    planSummary,
    planSteps,
    activeStepId,
    boardStatus,
    executionLog,
    artifactVersion,
    versionHistory,
    planEvents,
    final,
    finalState,
    events,
    setEvents,
    error,
    busy,
    setBusy,
    draggingStepId,
    setDraggingStepId,
    dragOverStatus,
    setDragOverStatus,
    boardEditStatus,
    setBoardEditStatus,
    canEditBoard,
    canContinue,
    resetView,
    applyValues,
    applyCustomEvent,
    handleCardDragEnd,
    startRun,
    failRun,
  };
}
