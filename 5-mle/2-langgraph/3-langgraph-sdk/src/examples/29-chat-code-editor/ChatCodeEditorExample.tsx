import {
  Check,
  Code2,
  GitPullRequest,
  Loader2,
  Play,
  RotateCcw,
  TestTube2,
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
  "Add a safe test scaffold marker to the FastAPI sample and show the diff before applying it.";
const files = ["app.py", "README.md"];

type JsonRecord = Record<string, unknown>;

type TestRecord = {
  phase: string;
  status: string;
  detail: string;
  tool: string;
};

type EditorEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

type ArtifactVersion = {
  path: string;
  name: string;
  before: string;
  after: string;
  summary: string;
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

function normalizeTestRecords(value: unknown): TestRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((record) => ({
    phase: typeof record.phase === "string" ? record.phase : "",
    status: typeof record.status === "string" ? record.status : "",
    detail: typeof record.detail === "string" ? record.detail : "",
    tool: typeof record.tool === "string" ? record.tool : "",
  }));
}

function normalizeEditorEvents(value: unknown): EditorEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "chat_code_editor",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    progress: numberValue(event.progress),
  }));
}

function normalizeHistory(value: unknown): ArtifactVersion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((version) => ({
    path: typeof version.path === "string" ? version.path : "",
    name: typeof version.name === "string" ? version.name : "",
    before: typeof version.before === "string" ? version.before : "",
    after: typeof version.after === "string" ? version.after : "",
    summary: typeof version.summary === "string" ? version.summary : "",
  }));
}

function mergeEditorEvents(current: EditorEvent[], next: EditorEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.progress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ChatCodeEditorExample() {
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

  const client = useMemo(() => createLangGraphClient(), []);
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
    if (typeof values.file_name === "string") setFileName(values.file_name);
    if (typeof values.file_before === "string") setFileBefore(values.file_before);
    if (typeof values.file_after === "string") setFileAfter(values.file_after);
    if (typeof values.proposal_summary === "string") setProposalSummary(values.proposal_summary);
    if (typeof values.proposal_diff === "string") setProposalDiff(values.proposal_diff);
    if (typeof values.diff_reason === "string") setDiffReason(values.diff_reason);
    if (typeof values.test_log === "string") setTestLog(values.test_log);
    if (Array.isArray(values.test_records)) setTestRecords(normalizeTestRecords(values.test_records));
    if (typeof values.approval_log === "string") setApprovalLog(values.approval_log);
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (Array.isArray(values.artifact_history)) setArtifactHistory(normalizeHistory(values.artifact_history));
    if (Array.isArray(values.editor_events)) {
      setEditorEvents((current) => mergeEditorEvents(current, normalizeEditorEvents(values.editor_events)));
    }
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "chat_code_editor") return;
    setEditorEvents((current) => mergeEditorEvents(current, normalizeEditorEvents([data])));
  }

  async function streamRun(input: JsonRecord, reuseThreadId = "") {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming artifact update" : "Creating code editor thread");

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

  return (
    <section className="code-editor-layout">
      <aside className="code-editor-control">
        <div className="panel-title">
          <Code2 aria-hidden="true" size={18} />
          Code Editor Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form className="run-form" onSubmit={submitProposal}>
          <label className="field">
            <span>Change request</span>
            <textarea
              value={userRequest}
              onChange={(event) => setUserRequest(event.target.value)}
              rows={5}
            />
          </label>
          <label className="field">
            <span>File</span>
            <select value={selectedFile} onChange={(event) => setSelectedFile(event.target.value)} disabled={busy}>
              {files.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !userRequest.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run code agent
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

      <div className={`code-editor-status-panel ${finalStatus}`} role="region" aria-label="Code Editor Status">
        <div className="panel-title">Code Editor Status</div>
        <div className="code-editor-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Proposal</span>
            <strong>{hasProposal ? "ready" : "pending"}</strong>
          </div>
          <div>
            <span>Tests</span>
            <strong>{testRecords.length}</strong>
          </div>
          <div>
            <span>Approval</span>
            <strong>{approvalLog || "pending"}</strong>
          </div>
        </div>
      </div>

      <div className="code-chat-panel" role="region" aria-label="Chat Transcript">
        <div className="panel-title">Chat Transcript</div>
        <div className="code-chat-message user">
          <strong>User</strong>
          <p>{userRequest}</p>
        </div>
        <div className="code-chat-message assistant">
          <strong>Assistant</strong>
          <p>{proposalSummary || final || "No code proposal yet."}</p>
        </div>
      </div>

      <div className="code-artifact-panel" role="region" aria-label="Code Artifact">
        <div className="panel-title">
          <Code2 aria-hidden="true" size={16} />
          Code Artifact
        </div>
        <div className="code-editor-tabs">
          <span>{fileName}</span>
          <code>{diffReason || "no pending edit"}</code>
        </div>
        <pre>{fileAfter || fileBefore || "Run the code agent to load a sample artifact."}</pre>
      </div>

      <div className="code-diff-panel" role="region" aria-label="Diff Proposal">
        <div className="panel-title">
          <GitPullRequest aria-hidden="true" size={16} />
          Diff Proposal
        </div>
        <pre>{proposalDiff || "No diff proposal yet."}</pre>
      </div>

      <div className="code-test-panel" role="region" aria-label="Test Log">
        <div className="panel-title">
          <TestTube2 aria-hidden="true" size={16} />
          Test Log
        </div>
        <p className="final-line">{testLog || "No test log yet."}</p>
        <div className="code-test-list">
          {testRecords.map((record) => (
            <article key={`${record.phase}-${record.tool}`} className={`code-test-row ${record.status}`}>
              <strong>{record.phase}</strong>
              <span>{record.status}</span>
              <p>{record.detail}</p>
              <code>{record.tool}</code>
            </article>
          ))}
        </div>
      </div>

      <div className="code-approval-panel" role="region" aria-label="Approval Controls">
        <div className="panel-title">Approval Controls</div>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={() => resolveProposal("approve")} disabled={!canApprove}>
            <Check size={16} />
            Approve change
          </button>
          <button type="button" className="secondary-button" onClick={() => resolveProposal("reject")} disabled={!canApprove}>
            <X size={16} />
            Reject change
          </button>
        </div>
        <p className="final-line">{final || "Diffs remain proposed until approval."}</p>
      </div>

      <div className="code-history-panel" role="region" aria-label="Version History">
        <div className="panel-title">Version History</div>
        <div className="code-history-list">
          {artifactHistory.length === 0 ? (
            <p className="muted">No applied versions yet.</p>
          ) : (
            artifactHistory.map((version, index) => (
              <article key={`${version.path}-${index}`} className="code-history-row">
                <strong>v{index + 1} {version.path}</strong>
                <p>{version.summary}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="code-editor-events-panel" role="region" aria-label="Code Editor Events">
        <div className="panel-title">Code Editor Events</div>
        <div className="code-editor-event-list">
          {editorEvents.length === 0 ? (
            <p className="muted">No editor events yet.</p>
          ) : (
            editorEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className="code-editor-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{percent(event.progress)}%</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel code-editor-final-state" role="region" aria-label="Final State">
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
