import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { type JsonRecord, nodePayloads, valuesOf } from "./model";

import { useChatCodeEditorState } from "./useChatCodeEditorState";

// SDK requests, browser input preparation, and stream consumption.
export function useChatCodeEditor() {
  const state = useChatCodeEditorState();
  const {
    userRequest,
    selectedFile,
    threadId,
    setThreadId,
    setStatus,
    setFinalStatus,
    setProposalSummary,
    setProposalDiff,
    setDiffReason,
    setTestLog,
    setTestRecords,
    setApprovalLog,
    setArtifactVersion,
    setArtifactHistory,
    setEditorEvents,
    setFinal,
    setFinalState,
    setEvents,
    setBusy,
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
              metadata: { example: "29-chat-code-editor" },
            })
          ).thread_id,
        );
      setThreadId(nextThreadId);
      setStatus("Streaming code editor graph");

      const stream = await client.runs.stream(nextThreadId, "29_chat_code_editor", {
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

  async function submitProposal() {
    const request = userRequest.trim();
    if (!request) return;
    setThreadId("");
    setFinalStatus("running");
    setProposalSummary("");
    setProposalDiff("");
    setDiffReason("");
    setTestLog("");
    setTestRecords([]);
    setApprovalLog("");
    setArtifactVersion(0);
    setArtifactHistory([]);
    setEditorEvents([]);
    setFinal("");
    setFinalState(null);
    await streamRun({
      user_request: request,
      selected_file: selectedFile,
      approval: "pending",
    });
  }

  async function resolveProposal(approval: "approve" | "reject") {
    if (!threadId) return;
    await streamRun({ approval }, threadId);
  }

  return {
    userRequest,
    setUserRequest: state.setUserRequest,
    selectedFile,
    setSelectedFile: state.setSelectedFile,
    threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    fileName: state.fileName,
    fileBefore: state.fileBefore,
    fileAfter: state.fileAfter,
    proposalSummary: state.proposalSummary,
    proposalDiff: state.proposalDiff,
    diffReason: state.diffReason,
    testLog: state.testLog,
    testRecords: state.testRecords,
    approvalLog: state.approvalLog,
    artifactVersion: state.artifactVersion,
    artifactHistory: state.artifactHistory,
    editorEvents: state.editorEvents,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    hasProposal: state.hasProposal,
    canApprove: state.canApprove,
    resetView: state.resetView,
    resolveProposal,
    submitProposal,
  };
}
