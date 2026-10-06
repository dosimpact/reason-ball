import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { type JsonRecord, nodePayloads, valuesOf } from "./model";

import { useChatGraphExecutionCanvasState } from "./useChatGraphExecutionCanvasState";

// SDK requests, browser input preparation, and stream consumption.
export function useChatGraphExecutionCanvas() {
  const state = useChatGraphExecutionCanvasState();
  const {
    userPrompt,
    threadId,
    setThreadId,
    setStatus,
    setFinalStatus,
    selectedEventId,
    setEvents,
    setBusy,
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
              metadata: { example: "32-chat-graph-execution-canvas" },
            })
          ).thread_id,
        );
      setThreadId(nextThreadId);
      setStatus("Streaming graph canvas");

      const stream = await client.runs.stream(nextThreadId, "32_chat_graph_execution_canvas", {
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
    } catch (caught) {
      failRun(caught);
    } finally {
      setBusy(false);
    }
  }

  async function runInspect() {
    const prompt = userPrompt.trim();
    if (!prompt) return;
    resetView();
    setFinalStatus("running");
    await streamRun({ user_prompt: prompt, action: "inspect" });
  }

  async function inspectSelectedEvent() {
    if (!threadId || !selectedEventId) return;
    await streamRun({ action: "select_event", selected_event_id: selectedEventId }, threadId);
  }

  async function runTimeTravel() {
    if (!threadId || !selectedEventId) return;
    await streamRun({ action: "time_travel", selected_event_id: selectedEventId }, threadId);
  }

  return {
    userPrompt,
    setUserPrompt: state.setUserPrompt,
    threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    canvasTitle: state.canvasTitle,
    chatSummary: state.chatSummary,
    graphNodes: state.graphNodes,
    graphEdges: state.graphEdges,
    executionEvents: state.executionEvents,
    checkpoints: state.checkpoints,
    stateDiff: state.stateDiff,
    selectedEventId,
    selectedEvent: state.selectedEvent,
    activeNode: state.activeNode,
    setActiveNode: state.setActiveNode,
    replaySummary: state.replaySummary,
    artifactVersion: state.artifactVersion,
    versionHistory: state.versionHistory,
    canvasEvents: state.canvasEvents,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    canInspect: state.canInspect,
    activeNodeDetail: state.activeNodeDetail,
    selectedCheckpoint: state.selectedCheckpoint,
    resetView,
    chooseEvent: state.chooseEvent,
    inspectSelectedEvent,
    runTimeTravel,
    runInspect,
  };
}
