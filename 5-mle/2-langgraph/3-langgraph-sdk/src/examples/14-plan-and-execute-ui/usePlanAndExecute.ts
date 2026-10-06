import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { valuesOf, nodePayloads } from "./data";
import { usePlanAndExecuteState } from "./usePlanAndExecuteState";

// Coordinates thread creation, SDK requests, stream routing and final-state lookup.
export function usePlanAndExecute() {
  const state = usePlanAndExecuteState();
  const {
    task,
    controlMode,
    setThreadId,
    setStatus,
    setEvents,
    setError,
    setBusy,
    applyValues,
    applyCustomEvent,
    prepareRunPlan,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runPlan() {
    const trimmed = task.trim();
    if (!trimmed) return;

    prepareRunPlan();

    try {
      const thread = await client.threads.create({
        metadata: { example: "14-plan-and-execute-ui", controlMode },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming plan execution");

      const stream = await client.runs.stream(
        nextThreadId,
        "14_plan_and_execute",
        {
          input: { task: trimmed, control_mode: controlMode },
          streamMode: ["updates", "custom"] as ["updates", "custom"],
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 120));
        if (logEntry.event === "custom") {
          applyCustomEvent(logEntry.data);
        }
        for (const payload of nodePayloads(logEntry.data)) {
          applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      applyValues(values);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return {
    task: state.task,
    setTask: state.setTask,
    controlMode: state.controlMode,
    setControlMode: state.setControlMode,
    threadId: state.threadId,
    status: state.status,
    executionStatus: state.executionStatus,
    planSteps: state.planSteps,
    completedSteps: state.completedSteps,
    stepEvents: state.stepEvents,
    planVersion: state.planVersion,
    replanned: state.replanned,
    stopped: state.stopped,
    stopReason: state.stopReason,
    finalAnswer: state.finalAnswer,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    activeStep: state.activeStep,
    resetView: state.resetView,
    runPlan,
  };
}

export type PlanAndExecuteController = ReturnType<typeof usePlanAndExecute>;
