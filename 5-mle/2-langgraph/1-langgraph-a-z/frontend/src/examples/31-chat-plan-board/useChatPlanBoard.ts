import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { type JsonRecord, nodePayloads, type PlanStatus, valuesOf } from "./model";

import { useChatPlanBoardState } from "./useChatPlanBoardState";

// SDK requests, browser input preparation, and stream consumption.
export function useChatPlanBoard() {
  const state = useChatPlanBoardState();
  const {
    userGoal,
    revisionNote,
    threadId,
    setThreadId,
    setStatus,
    setFinalStatus,
    planSteps,
    setEvents,
    setBusy,
    setDraggingStepId,
    setDragOverStatus,
    setBoardEditStatus,
    canEditBoard,
    resetView,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function streamRun(input: JsonRecord, reuseThreadId = "") {
    startRun(reuseThreadId);

    try {
      const nextThreadId =
        reuseThreadId ||
        String(
          (
            await client.threads.create({
              metadata: { example: "31-chat-plan-board" },
            })
          ).thread_id,
        );
      setThreadId(nextThreadId);
      setStatus("Streaming plan board graph");

      const stream = await client.runs.stream(nextThreadId, "31_chat_plan_board", {
        input,
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 180));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
      return true;
    } catch (caught) {
      failRun(caught);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitPlan() {
    const goal = userGoal.trim();
    if (!goal) return;
    resetView();
    setFinalStatus("running");
    await streamRun({ user_goal: goal, action: "create" });
  }

  async function continuePlan() {
    if (!threadId) return;
    await streamRun({ action: "continue" }, threadId);
  }

  async function revisePlan() {
    if (!threadId) return;
    await streamRun({ action: "revise", revision_note: revisionNote }, threadId);
  }

  async function moveStep(stepId: string, targetStatus: PlanStatus) {
    const movedStep = planSteps.find((step) => step.id === stepId);
    setDraggingStepId("");
    setDragOverStatus("");

    if (!threadId || !movedStep || !canEditBoard) return;
    if (movedStep.status === targetStatus) {
      setBoardEditStatus(`${movedStep.title} is already ${targetStatus}.`);
      return;
    }

    setBoardEditStatus(`Saving ${movedStep.title} to ${targetStatus}.`);
    const moved = await streamRun({ action: "move_step", step_id: stepId, target_status: targetStatus }, threadId);
    setBoardEditStatus(moved ? `Saved ${movedStep.title} to ${targetStatus}.` : `Could not save ${movedStep.title}.`);
  }

  return {
    userGoal,
    setUserGoal: state.setUserGoal,
    revisionNote,
    setRevisionNote: state.setRevisionNote,
    threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    planTitle: state.planTitle,
    planSummary: state.planSummary,
    planSteps,
    activeStepId: state.activeStepId,
    boardStatus: state.boardStatus,
    executionLog: state.executionLog,
    artifactVersion: state.artifactVersion,
    versionHistory: state.versionHistory,
    planEvents: state.planEvents,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    draggingStepId: state.draggingStepId,
    setDraggingStepId,
    dragOverStatus: state.dragOverStatus,
    setDragOverStatus,
    boardEditStatus: state.boardEditStatus,
    canEditBoard,
    canContinue: state.canContinue,
    resetView,
    handleCardDragEnd: state.handleCardDragEnd,
    moveStep,
    continuePlan,
    revisePlan,
    submitPlan,
  };
}
