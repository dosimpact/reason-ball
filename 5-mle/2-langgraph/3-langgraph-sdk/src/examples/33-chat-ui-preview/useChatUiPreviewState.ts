import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import { defaultRequest, mergePreviewEvents, normalizeApprovalLog, normalizeControls, normalizePreviewEvents, normalizeStrings, normalizeTree, normalizeVersions, type ApprovalLog, type JsonRecord, type PreviewEvent, type PreviewVersion, type StyleControl, type TreeEntry } from "./model";

// Local state, derived values, and synchronous state transitions.
export function useChatUiPreviewState() {
  const [userRequest, setUserRequest] = useState(defaultRequest);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [componentName, setComponentName] = useState("PreviewComponent");
  const [designSummary, setDesignSummary] = useState("");
  const [componentCode, setComponentCode] = useState("");
  const [proposedCode, setProposedCode] = useState("");
  const [previewMarkup, setPreviewMarkup] = useState("");
  const [componentTree, setComponentTree] = useState<TreeEntry[]>([]);
  const [styleControls, setStyleControls] = useState<StyleControl[]>([]);
  const [diffLines, setDiffLines] = useState<string[]>([]);
  const [previewStatus, setPreviewStatus] = useState("idle");
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([]);
  const [approvalLog, setApprovalLog] = useState<ApprovalLog[]>([]);
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [versionHistory, setVersionHistory] = useState<PreviewVersion[]>([]);
  const [previewEvents, setPreviewEvents] = useState<PreviewEvent[]>([]);
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canApprove = Boolean(threadId) && proposedCode.length > 0 && !busy;

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setComponentName("PreviewComponent");
    setDesignSummary("");
    setComponentCode("");
    setProposedCode("");
    setPreviewMarkup("");
    setComponentTree([]);
    setStyleControls([]);
    setDiffLines([]);
    setPreviewStatus("idle");
    setPreviewErrors([]);
    setSandboxLogs([]);
    setApprovalLog([]);
    setArtifactVersion(0);
    setVersionHistory([]);
    setPreviewEvents([]);
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.component_name)) setComponentName(values.component_name);
    if (R.isString(values.design_summary)) setDesignSummary(values.design_summary);
    if (R.isString(values.component_code)) setComponentCode(values.component_code);
    if (R.isString(values.proposed_code)) setProposedCode(values.proposed_code);
    if (R.isString(values.preview_markup)) setPreviewMarkup(values.preview_markup);
    if (R.isArray(values.component_tree)) setComponentTree(normalizeTree(values.component_tree));
    if (R.isArray(values.style_controls)) setStyleControls(normalizeControls(values.style_controls));
    if (R.isArray(values.diff_lines)) setDiffLines(normalizeStrings(values.diff_lines));
    if (R.isString(values.preview_status)) setPreviewStatus(values.preview_status);
    if (R.isArray(values.preview_errors)) setPreviewErrors(normalizeStrings(values.preview_errors));
    if (R.isArray(values.sandbox_logs)) setSandboxLogs(normalizeStrings(values.sandbox_logs));
    if (R.isArray(values.approval_log)) setApprovalLog(normalizeApprovalLog(values.approval_log));
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (R.isArray(values.version_history)) setVersionHistory(normalizeVersions(values.version_history));
    if (R.isArray(values.preview_events)) {
      setPreviewEvents((current) => mergePreviewEvents(current, normalizePreviewEvents(values.preview_events)));
    }
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status)) setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "33_chat_ui_preview") return;
    setPreviewEvents((current) => mergePreviewEvents(current, normalizePreviewEvents([data])));
  }

  function startRun(reuseThreadId: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming preview update" : "Creating UI preview thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setFinalStatus("failed");
    setStatus("Run failed");
  }

  return {
    userRequest,
    setUserRequest,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    setFinalStatus,
    componentName,
    designSummary,
    componentCode,
    proposedCode,
    previewMarkup,
    componentTree,
    styleControls,
    diffLines,
    previewStatus,
    previewErrors,
    sandboxLogs,
    approvalLog,
    artifactVersion,
    versionHistory,
    previewEvents,
    final,
    finalState,
    events,
    setEvents,
    error,
    busy,
    setBusy,
    canApprove,
    resetView,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  };
}
