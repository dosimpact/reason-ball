import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { nodePayloads, serializeSections, valuesOf, type JsonRecord } from "./model";

import { useChatDocumentArtifactState } from "./useChatDocumentArtifactState";

// SDK requests, browser input preparation, and stream consumption.
export function useChatDocumentArtifact() {
  const state = useChatDocumentArtifactState();
  const {
    userRequest,
    tone,
    targetLength,
    focusSection,
    threadId,
    setThreadId,
    setStatus,
    setFinalStatus,
    documentTitle,
    documentSummary,
    documentSections,
    setUserEditDirty,
    setEvents,
    setBusy,
    hasProposal,
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
              metadata: { example: "30-chat-document-artifact" },
            })
          ).thread_id,
        );
      setThreadId(nextThreadId);
      setStatus("Streaming document graph");

      const stream = await client.runs.stream(nextThreadId, "30_chat_document_artifact", {
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
    resetView();
    setFinalStatus("running");
    setUserEditDirty(false);
    await streamRun({
      action: "draft",
      user_request: request,
      tone,
      target_length: targetLength,
      focus_section: focusSection,
      approval: "pending",
    });
  }

  function canvasPayload(extra: JsonRecord = {}): JsonRecord {
    return {
      user_request: userRequest.trim(),
      tone,
      target_length: targetLength,
      focus_section: focusSection,
      document_title: documentTitle,
      document_summary: documentSummary,
      sections: serializeSections(documentSections),
      ...extra,
    };
  }

  async function saveUserEdits() {
    if (!threadId || !hasProposal) return;
    await streamRun(canvasPayload({ action: "save_user_edit", approval: "pending" }), threadId);
  }

  async function reviseCanvasWithAi() {
    if (!threadId || !hasProposal) return;
    await streamRun(canvasPayload({ action: "ai_revise", approval: "pending" }), threadId);
  }

  async function resolveProposal(approval: "approve" | "reject") {
    if (!threadId) return;
    await streamRun(canvasPayload({ action: approval, approval }), threadId);
  }

  return {
    userRequest,
    setUserRequest: state.setUserRequest,
    tone,
    setTone: state.setTone,
    targetLength,
    setTargetLength: state.setTargetLength,
    focusSection,
    setFocusSection: state.setFocusSection,
    threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    documentTitle,
    documentSummary,
    documentSections,
    comments: state.comments,
    qualityChecks: state.qualityChecks,
    qualityScore: state.qualityScore,
    revisionSummary: state.revisionSummary,
    artifactVersion: state.artifactVersion,
    versionHistory: state.versionHistory,
    approvalLog: state.approvalLog,
    lastEditor: state.lastEditor,
    userEditDirty: state.userEditDirty,
    documentEvents: state.documentEvents,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    hasProposal,
    canApprove: state.canApprove,
    canSaveUserEdits: state.canSaveUserEdits,
    canAiRevise: state.canAiRevise,
    resetView,
    updateDocumentTitle: state.updateDocumentTitle,
    updateDocumentSummary: state.updateDocumentSummary,
    updateSectionText: state.updateSectionText,
    resolveProposal,
    saveUserEdits,
    reviseCanvasWithAi,
    submitProposal,
  };
}
