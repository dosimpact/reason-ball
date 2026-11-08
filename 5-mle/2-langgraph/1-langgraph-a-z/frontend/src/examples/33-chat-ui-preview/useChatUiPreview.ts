import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { type JsonRecord, nodePayloads, valuesOf } from "./model";

import { useChatUiPreviewState } from "./useChatUiPreviewState";

// SDK requests, browser input preparation, and stream consumption.
export function useChatUiPreview() {
  const state = useChatUiPreviewState();
  const {
    userRequest,
    threadId,
    setThreadId,
    setStatus,
    setFinalStatus,
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
              metadata: { example: "33-chat-ui-preview" },
            })
          ).thread_id,
        );
      setThreadId(nextThreadId);
      setStatus("Streaming UI preview graph");

      const stream = await client.runs.stream(nextThreadId, "33_chat_ui_preview", {
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

  async function runPreview() {
    const request = userRequest.trim();
    if (!request) return;
    resetView();
    setFinalStatus("running");
    await streamRun({ user_request: request, action: "generate" });
  }

  async function applyPreview() {
    if (!threadId) return;
    await streamRun({ action: "apply", approval: "approve" }, threadId);
  }

  async function revertPreview() {
    if (!threadId) return;
    await streamRun({ action: "revert", approval: "revert" }, threadId);
  }

  return {
    userRequest,
    setUserRequest: state.setUserRequest,
    threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    componentName: state.componentName,
    designSummary: state.designSummary,
    componentCode: state.componentCode,
    proposedCode: state.proposedCode,
    previewMarkup: state.previewMarkup,
    componentTree: state.componentTree,
    styleControls: state.styleControls,
    diffLines: state.diffLines,
    previewStatus: state.previewStatus,
    previewErrors: state.previewErrors,
    sandboxLogs: state.sandboxLogs,
    approvalLog: state.approvalLog,
    artifactVersion: state.artifactVersion,
    versionHistory: state.versionHistory,
    previewEvents: state.previewEvents,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    canApprove: state.canApprove,
    resetView,
    applyPreview,
    revertPreview,
    runPreview,
  };
}
