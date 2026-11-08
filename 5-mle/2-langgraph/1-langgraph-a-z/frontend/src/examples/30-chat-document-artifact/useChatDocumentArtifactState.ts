import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import { defaultRequest, mergeDocumentEvents, normalizeComments, normalizeDocumentEvents, normalizeQualityChecks, normalizeSections, normalizeVersions, type DocumentComment, type DocumentEvent, type DocumentSection, type DocumentVersion, type JsonRecord, type QualityCheck } from "./model";

// Local state, derived values, and synchronous state transitions.
export function useChatDocumentArtifactState() {
  const [userRequest, setUserRequest] = useState(defaultRequest);
  const [tone, setTone] = useState("professional");
  const [targetLength, setTargetLength] = useState("concise");
  const [focusSection, setFocusSection] = useState("all");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [documentTitle, setDocumentTitle] = useState("Launch Readiness Brief");
  const [documentSummary, setDocumentSummary] = useState("");
  const [documentSections, setDocumentSections] = useState<DocumentSection[]>([]);
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [qualityScore, setQualityScore] = useState(0);
  const [revisionSummary, setRevisionSummary] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [versionHistory, setVersionHistory] = useState<DocumentVersion[]>([]);
  const [approvalLog, setApprovalLog] = useState("");
  const [lastEditor, setLastEditor] = useState("none");
  const [userEditDirty, setUserEditDirty] = useState(false);
  const [documentEvents, setDocumentEvents] = useState<DocumentEvent[]>([]);
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasProposal = documentSections.length > 0;
  const canApprove = hasProposal && finalStatus === "awaiting_approval" && !busy && Boolean(threadId);
  const canSaveUserEdits = hasProposal && userEditDirty && !busy && Boolean(threadId);
  const canAiRevise = hasProposal && !busy && Boolean(threadId);

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setDocumentTitle("Launch Readiness Brief");
    setDocumentSummary("");
    setDocumentSections([]);
    setComments([]);
    setQualityChecks([]);
    setQualityScore(0);
    setRevisionSummary("");
    setArtifactVersion(0);
    setVersionHistory([]);
    setApprovalLog("");
    setLastEditor("none");
    setUserEditDirty(false);
    setDocumentEvents([]);
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.document_title)) setDocumentTitle(values.document_title);
    if (R.isString(values.document_summary)) setDocumentSummary(values.document_summary);
    if (R.isArray(values.sections)) {
      setDocumentSections(normalizeSections(values.sections));
      setUserEditDirty(false);
    }
    if (R.isArray(values.comments)) setComments(normalizeComments(values.comments));
    if (R.isArray(values.quality_checks)) setQualityChecks(normalizeQualityChecks(values.quality_checks));
    if (typeof values.quality_score === "number") setQualityScore(values.quality_score);
    if (R.isString(values.revision_summary)) setRevisionSummary(values.revision_summary);
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (R.isArray(values.version_history)) setVersionHistory(normalizeVersions(values.version_history));
    if (R.isString(values.approval_log)) setApprovalLog(values.approval_log);
    if (R.isString(values.last_editor)) setLastEditor(values.last_editor);
    if (R.isArray(values.document_events)) {
      setDocumentEvents((current) => mergeDocumentEvents(current, normalizeDocumentEvents(values.document_events)));
    }
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status)) setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "30_chat_document_artifact") return;
    setDocumentEvents((current) => mergeDocumentEvents(current, normalizeDocumentEvents([data])));
  }

  function updateDocumentTitle(value: string) {
    setDocumentTitle(value);
    if (hasProposal) setUserEditDirty(true);
  }

  function updateDocumentSummary(value: string) {
    setDocumentSummary(value);
    if (hasProposal) setUserEditDirty(true);
  }

  function updateSectionText(sectionId: string, value: string) {
    setDocumentSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
            ...section,
            after: value,
            changeSummary: "Unsaved user edit in the document canvas.",
            status: "user_editing",
          }
          : section,
      ),
    );
    setUserEditDirty(true);
  }

  function startRun(reuseThreadId: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming document update" : "Creating document thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setFinalStatus("failed");
    setStatus("Run failed");
  }

  return {
    userRequest,
    setUserRequest,
    tone,
    setTone,
    targetLength,
    setTargetLength,
    focusSection,
    setFocusSection,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    setFinalStatus,
    documentTitle,
    documentSummary,
    documentSections,
    comments,
    qualityChecks,
    qualityScore,
    revisionSummary,
    artifactVersion,
    versionHistory,
    approvalLog,
    lastEditor,
    userEditDirty,
    setUserEditDirty,
    documentEvents,
    final,
    finalState,
    events,
    setEvents,
    error,
    busy,
    setBusy,
    hasProposal,
    canApprove,
    canSaveUserEdits,
    canAiRevise,
    resetView,
    applyValues,
    applyCustomEvent,
    updateDocumentTitle,
    updateDocumentSummary,
    updateSectionText,
    startRun,
    failRun,
  };
}
