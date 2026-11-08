import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import { type ArtifactVersion, defaultRequest, type EditorEvent, type JsonRecord, mergeEditorEvents, normalizeEditorEvents, normalizeHistory, normalizeTestRecords, type TestRecord } from "./model";

// Local state, derived values, and synchronous state transitions.
export function useChatCodeEditorState() {
  const [userRequest, setUserRequest] = useState(defaultRequest);
  const [selectedFile, setSelectedFile] = useState("app.py");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [fileName, setFileName] = useState("app.py");
  const [fileBefore, setFileBefore] = useState("");
  const [fileAfter, setFileAfter] = useState("");
  const [proposalSummary, setProposalSummary] = useState("");
  const [proposalDiff, setProposalDiff] = useState("");
  const [diffReason, setDiffReason] = useState("");
  const [testLog, setTestLog] = useState("");
  const [testRecords, setTestRecords] = useState<TestRecord[]>([]);
  const [approvalLog, setApprovalLog] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [artifactHistory, setArtifactHistory] = useState<ArtifactVersion[]>([]);
  const [editorEvents, setEditorEvents] = useState<EditorEvent[]>([]);
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasProposal = Boolean(proposalDiff);
  const canApprove = hasProposal && finalStatus === "awaiting_approval" && !busy && Boolean(threadId);

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setFileName(selectedFile);
    setFileBefore("");
    setFileAfter("");
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
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.file_name)) setFileName(values.file_name);
    if (R.isString(values.file_before)) setFileBefore(values.file_before);
    if (R.isString(values.file_after)) setFileAfter(values.file_after);
    if (R.isString(values.proposal_summary)) setProposalSummary(values.proposal_summary);
    if (R.isString(values.proposal_diff)) setProposalDiff(values.proposal_diff);
    if (R.isString(values.diff_reason)) setDiffReason(values.diff_reason);
    if (R.isString(values.test_log)) setTestLog(values.test_log);
    if (R.isArray(values.test_records)) setTestRecords(normalizeTestRecords(values.test_records));
    if (R.isString(values.approval_log)) setApprovalLog(values.approval_log);
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (R.isArray(values.artifact_history)) setArtifactHistory(normalizeHistory(values.artifact_history));
    if (R.isArray(values.editor_events)) {
      setEditorEvents((current) => mergeEditorEvents(current, normalizeEditorEvents(values.editor_events)));
    }
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status)) setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "29_chat_code_editor") return;
    setEditorEvents((current) => mergeEditorEvents(current, normalizeEditorEvents([data])));
  }

  function startRun(reuseThreadId: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming artifact update" : "Creating code editor thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setFinalStatus("failed");
    setStatus("Run failed");
  }

  return {
    userRequest,
    setUserRequest,
    selectedFile,
    setSelectedFile,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    setFinalStatus,
    fileName,
    fileBefore,
    fileAfter,
    proposalSummary,
    setProposalSummary,
    proposalDiff,
    setProposalDiff,
    diffReason,
    setDiffReason,
    testLog,
    setTestLog,
    testRecords,
    setTestRecords,
    approvalLog,
    setApprovalLog,
    artifactVersion,
    setArtifactVersion,
    artifactHistory,
    setArtifactHistory,
    editorEvents,
    setEditorEvents,
    final,
    setFinal,
    finalState,
    setFinalState,
    events,
    setEvents,
    error,
    busy,
    setBusy,
    hasProposal,
    canApprove,
    resetView,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  };
}
