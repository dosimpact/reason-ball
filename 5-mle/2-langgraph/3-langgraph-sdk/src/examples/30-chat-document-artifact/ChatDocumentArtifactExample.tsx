import {
  Bot,
  Check,
  ClipboardCheck,
  FileText,
  Loader2,
  MessageSquareText,
  Play,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultRequest =
  "Rewrite the launch brief to be more professional, concise, and clear for executive reviewers.";
const tones = ["professional", "friendly", "executive", "plain"];
const lengths = ["concise", "standard", "expanded"];
const sections = [
  { id: "all", label: "All sections" },
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "next_steps", label: "Next Steps" },
];

type JsonRecord = Record<string, unknown>;

type DocumentSection = {
  id: string;
  title: string;
  before: string;
  after: string;
  changeSummary: string;
  status: string;
};

type DocumentComment = {
  id: string;
  sectionId: string;
  severity: string;
  text: string;
};

type QualityCheck = {
  label: string;
  status: string;
  detail: string;
};

type DocumentVersion = {
  version: number;
  title: string;
  summary: string;
  sections: DocumentSection[];
};

type DocumentEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function normalizeSections(value: unknown): DocumentSection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((section) => ({
    id: typeof section.id === "string" ? section.id : "",
    title: typeof section.title === "string" ? section.title : "",
    before: typeof section.before === "string" ? section.before : "",
    after: typeof section.after === "string" ? section.after : "",
    changeSummary:
      typeof section.change_summary === "string"
        ? section.change_summary
        : typeof section.changeSummary === "string"
          ? section.changeSummary
          : "",
    status: typeof section.status === "string" ? section.status : "",
  }));
}

function serializeSections(sectionsValue: DocumentSection[]): JsonRecord[] {
  return sectionsValue.map((section) => ({
    id: section.id,
    title: section.title,
    before: section.before,
    after: section.after,
    change_summary: section.changeSummary,
    status: section.status,
  }));
}

function normalizeComments(value: unknown): DocumentComment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((comment) => ({
    id: typeof comment.id === "string" ? comment.id : "",
    sectionId: typeof comment.section_id === "string" ? comment.section_id : "",
    severity: typeof comment.severity === "string" ? comment.severity : "",
    text: typeof comment.text === "string" ? comment.text : "",
  }));
}

function normalizeQualityChecks(value: unknown): QualityCheck[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((check) => ({
    label: typeof check.label === "string" ? check.label : "",
    status: typeof check.status === "string" ? check.status : "",
    detail: typeof check.detail === "string" ? check.detail : "",
  }));
}

function normalizeVersions(value: unknown): DocumentVersion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((version) => ({
    version: numberValue(version.version),
    title: typeof version.title === "string" ? version.title : "",
    summary: typeof version.summary === "string" ? version.summary : "",
    sections: normalizeSections(version.sections),
  }));
}

function normalizeDocumentEvents(value: unknown): DocumentEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "chat_document_artifact",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    progress: numberValue(event.progress),
  }));
}

function mergeDocumentEvents(current: DocumentEvent[], next: DocumentEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.progress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ChatDocumentArtifactExample() {
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

  const client = useMemo(() => createLangGraphClient(), []);
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
    if (typeof values.document_title === "string") setDocumentTitle(values.document_title);
    if (typeof values.document_summary === "string") setDocumentSummary(values.document_summary);
    if (Array.isArray(values.sections)) {
      setDocumentSections(normalizeSections(values.sections));
      setUserEditDirty(false);
    }
    if (Array.isArray(values.comments)) setComments(normalizeComments(values.comments));
    if (Array.isArray(values.quality_checks)) setQualityChecks(normalizeQualityChecks(values.quality_checks));
    if (typeof values.quality_score === "number") setQualityScore(values.quality_score);
    if (typeof values.revision_summary === "string") setRevisionSummary(values.revision_summary);
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (Array.isArray(values.version_history)) setVersionHistory(normalizeVersions(values.version_history));
    if (typeof values.approval_log === "string") setApprovalLog(values.approval_log);
    if (typeof values.last_editor === "string") setLastEditor(values.last_editor);
    if (Array.isArray(values.document_events)) {
      setDocumentEvents((current) => mergeDocumentEvents(current, normalizeDocumentEvents(values.document_events)));
    }
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "chat_document_artifact") return;
    setDocumentEvents((current) => mergeDocumentEvents(current, normalizeDocumentEvents([data])));
  }

  async function streamRun(input: JsonRecord, reuseThreadId = "") {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming document update" : "Creating document thread");

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
      setError(caught instanceof Error ? caught.message : String(caught));
      setFinalStatus("failed");
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitProposal(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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

  return (
    <section className="document-artifact-layout">
      <aside className="document-control">
        <div className="panel-title">
          <FileText aria-hidden="true" size={18} />
          Document Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form className="run-form" onSubmit={submitProposal}>
          <label className="field">
            <span>Document request</span>
            <textarea value={userRequest} onChange={(event) => setUserRequest(event.target.value)} rows={5} />
          </label>
          <div className="document-selector-grid">
            <label className="field">
              <span>Tone</span>
              <select value={tone} onChange={(event) => setTone(event.target.value)} disabled={busy}>
                {tones.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Length</span>
              <select value={targetLength} onChange={(event) => setTargetLength(event.target.value)} disabled={busy}>
                {lengths.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Focus section</span>
            <select value={focusSection} onChange={(event) => setFocusSection(event.target.value)} disabled={busy}>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !userRequest.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run document agent
            </button>
            <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>
        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span>Thread ID</span>
            <strong>{threadId || "none"}</strong>
          </div>
          <div>
            <span>Version</span>
            <strong>v{artifactVersion}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`document-status-panel ${finalStatus}`} role="region" aria-label="Document Artifact Status">
        <div className="panel-title">Document Artifact Status</div>
        <div className="document-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Sections</span>
            <strong>{documentSections.length}</strong>
          </div>
          <div>
            <span>Quality</span>
            <strong>{qualityScore ? `${Math.round(qualityScore * 100)}%` : "pending"}</strong>
          </div>
          <div>
            <span>Approval</span>
            <strong>{approvalLog || "pending"}</strong>
          </div>
          <div>
            <span>Last Editor</span>
            <strong>{lastEditor}</strong>
          </div>
        </div>
      </div>

      <div className="document-chat-panel" role="region" aria-label="Chat Transcript">
        <div className="panel-title">
          <MessageSquareText aria-hidden="true" size={16} />
          Chat Transcript
        </div>
        <article className="document-chat-message user">
          <strong>User</strong>
          <p>{userRequest}</p>
        </article>
        <article className="document-chat-message assistant">
          <strong>Assistant</strong>
          <p>{revisionSummary || final || "No document proposal yet."}</p>
        </article>
      </div>

      <div className="document-canvas-panel" role="region" aria-label="Document Canvas">
        <div className="panel-title">
          <FileText aria-hidden="true" size={16} />
          Document Canvas
        </div>
        <div className="document-canvas-header">
          <label className="document-title-field">
            <span>Title</span>
            <input
              aria-label="Document title"
              value={documentTitle}
              onChange={(event) => updateDocumentTitle(event.target.value)}
              disabled={!hasProposal || busy}
            />
          </label>
          <span>{tone} / {targetLength}</span>
        </div>
        <label className="field document-summary-field">
          <span>Summary</span>
          <textarea
            aria-label="Document summary"
            value={documentSummary || "Run the document agent to generate a structured artifact."}
            onChange={(event) => updateDocumentSummary(event.target.value)}
            rows={3}
            disabled={!hasProposal || busy}
          />
        </label>
        <div className="document-canvas-actions">
          <button type="button" className="secondary-button" onClick={saveUserEdits} disabled={!canSaveUserEdits}>
            <Save size={16} />
            Save user edits
          </button>
          <button type="button" className="primary-button" onClick={reviseCanvasWithAi} disabled={!canAiRevise}>
            <Bot size={16} />
            Ask AI to revise canvas
          </button>
          <span className={userEditDirty ? "document-edit-state dirty" : "document-edit-state"}>
            {userEditDirty ? "Unsaved user edit" : `Last editor: ${lastEditor}`}
          </span>
        </div>
        <div className="document-section-list">
          {documentSections.map((section) => (
            <article key={section.id} className={`document-section-card ${section.status}`}>
              <div>
                <strong>{section.title}</strong>
                <span>{section.status}</span>
              </div>
              <textarea
                aria-label={`Edit ${section.title} section`}
                value={section.after}
                onChange={(event) => updateSectionText(section.id, event.target.value)}
                rows={5}
                disabled={busy}
              />
            </article>
          ))}
        </div>
      </div>

      <div className="section-changes-panel" role="region" aria-label="Section Changes">
        <div className="panel-title">Section Changes</div>
        <div className="section-change-list">
          {documentSections.length === 0 ? (
            <p className="muted">No section changes yet.</p>
          ) : (
            documentSections.map((section) => (
              <article key={`${section.id}-change`} className="section-change-row">
                <strong>{section.title}</strong>
                <p>{section.changeSummary}</p>
                <code>{section.id}</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="document-comments-panel" role="region" aria-label="AI Comments">
        <div className="panel-title">AI Comments</div>
        <div className="document-comment-list">
          {comments.length === 0 ? (
            <p className="muted">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <article key={comment.id} className={`document-comment-row ${comment.severity}`}>
                <strong>{comment.sectionId}</strong>
                <span>{comment.severity}</span>
                <p>{comment.text}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="quality-review-panel" role="region" aria-label="Quality Review">
        <div className="panel-title">
          <ClipboardCheck aria-hidden="true" size={16} />
          Quality Review
        </div>
        <div className="quality-check-list">
          {qualityChecks.length === 0 ? (
            <p className="muted">No quality checks yet.</p>
          ) : (
            qualityChecks.map((check) => (
              <article key={check.label} className={`quality-check-row ${check.status}`}>
                <strong>{check.label}</strong>
                <span>{check.status}</span>
                <p>{check.detail}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="document-approval-panel" role="region" aria-label="Approval Controls">
        <div className="panel-title">Approval Controls</div>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={() => resolveProposal("approve")} disabled={!canApprove}>
            <Check size={16} />
            Approve document
          </button>
          <button type="button" className="secondary-button" onClick={() => resolveProposal("reject")} disabled={!canApprove}>
            <X size={16} />
            Reject document
          </button>
        </div>
        <p className="final-line">{final || "Document edits remain proposed until approval."}</p>
      </div>

      <div className="document-history-panel" role="region" aria-label="Version History">
        <div className="panel-title">Version History</div>
        <div className="document-history-list">
          {versionHistory.length === 0 ? (
            <p className="muted">No document versions yet.</p>
          ) : (
            versionHistory.map((version) => (
              <article key={version.version} className="document-history-row">
                <strong>v{version.version} {version.title}</strong>
                <p>{version.summary}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="document-events-panel" role="region" aria-label="Document Events">
        <div className="panel-title">Document Events</div>
        <div className="document-event-list">
          {documentEvents.length === 0 ? (
            <p className="muted">No document events yet.</p>
          ) : (
            documentEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className="document-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{percent(event.progress)}%</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel document-final-state" role="region" aria-label="Final State">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
      </div>

      <div className="event-panel" role="region" aria-label="Raw Stream Events">
        <div className="panel-title">Raw Stream Events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            events.map((entry) => (
              <details key={entry.id} className="event-row">
                <summary>
                  <span>{entry.receivedAt}</span>
                  <strong>event {entry.event}</strong>
                </summary>
                <pre>{formatJson(entry.data)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
