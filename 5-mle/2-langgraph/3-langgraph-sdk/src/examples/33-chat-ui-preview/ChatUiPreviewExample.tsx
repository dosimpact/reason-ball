import { Check, Code2, Eye, GitCompare, Loader2, Play, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();
const defaultRequest =
  "Create a compact launch status card with clear success metrics, a review badge, and one primary action.";

type JsonRecord = Record<string, unknown>;

type TreeEntry = {
  id: string;
  name: string;
  role: string;
  detail: string;
};

type StyleControl = {
  id: string;
  label: string;
  value: string;
};

type ApprovalLog = {
  action: string;
  detail: string;
};

type PreviewVersion = {
  version: number;
  componentName: string;
  summary: string;
};

type PreviewEvent = {
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

function normalizeTree(value: unknown): TreeEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((entry, index) => ({
    id: typeof entry.id === "string" ? entry.id : `node-${index + 1}`,
    name: typeof entry.name === "string" ? entry.name : typeof entry.label === "string" ? entry.label : `Node ${index + 1}`,
    role: typeof entry.role === "string" ? entry.role : typeof entry.type === "string" ? entry.type : "component",
    detail: typeof entry.detail === "string" ? entry.detail : typeof entry.summary === "string" ? entry.summary : "",
  }));
}

function normalizeControls(value: unknown): StyleControl[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((control, index) => ({
    id: typeof control.id === "string" ? control.id : `control-${index + 1}`,
    label: typeof control.label === "string" ? control.label : typeof control.name === "string" ? control.name : `Control ${index + 1}`,
    value: typeof control.value === "string" ? control.value : String(control.value ?? ""),
  }));
}

function normalizeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === "string") return entry;
    if (isRecord(entry)) return Object.values(entry).map(String).join(" ");
    return String(entry);
  });
}

function normalizeApprovalLog(value: unknown): ApprovalLog[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === "string") return { action: entry, detail: entry };
    if (isRecord(entry)) {
      return {
        action:
          typeof entry.action === "string"
            ? entry.action
            : typeof entry.approval === "string"
              ? entry.approval
              : "",
        detail: typeof entry.detail === "string" ? entry.detail : typeof entry.reason === "string" ? entry.reason : "",
      };
    }
    return { action: String(entry), detail: String(entry) };
  });
}

function normalizeVersions(value: unknown): PreviewVersion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((version) => ({
    version: numberValue(version.version),
    componentName:
      typeof version.component_name === "string"
        ? version.component_name
        : typeof version.componentName === "string"
          ? version.componentName
          : "",
    summary: typeof version.summary === "string" ? version.summary : "",
  }));
}

function normalizePreviewEvents(value: unknown): PreviewEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "chat_ui_preview",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    progress: numberValue(event.progress),
  }));
}

function mergePreviewEvents(current: PreviewEvent[], next: PreviewEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.progress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function previewDocument(markup: string) {
  const body = markup || "<p>No preview yet.</p>";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; background: #f5f8f7; color: #21302b; display: grid; place-items: center; padding: 18px; box-sizing: border-box; }
      * { box-sizing: border-box; }
      .preview-card { width: min(100%, 520px); border: 1px solid #bfd8d0; border-radius: 14px; background: #ffffff; box-shadow: 0 18px 50px rgba(30, 58, 50, 0.14); padding: 24px; }
      .preview-card__eyebrow { margin: 0 0 8px; color: #0f766e; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
      .preview-card h2 { margin: 0 0 10px; font-size: 26px; line-height: 1.1; }
      .preview-card p { margin: 0; color: #4d615b; line-height: 1.45; }
      .preview-card__metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 22px 0; }
      .preview-card__metric { border: 1px solid #dce8e4; border-radius: 10px; background: #f4fbf8; padding: 12px; }
      .preview-card__metric span { display: block; color: #0f3f36; font-size: 22px; font-weight: 800; }
      .preview-card__metric small { color: #60756f; font-size: 12px; font-weight: 700; }
      .preview-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #e2ebe7; padding-top: 16px; color: #60756f; font-size: 13px; }
      .preview-card button { border: 0; border-radius: 8px; background: #0f766e; color: white; font-weight: 800; padding: 10px 14px; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

export function ChatUiPreviewExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
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

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
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
    if (typeof values.component_name === "string") setComponentName(values.component_name);
    if (typeof values.design_summary === "string") setDesignSummary(values.design_summary);
    if (typeof values.component_code === "string") setComponentCode(values.component_code);
    if (typeof values.proposed_code === "string") setProposedCode(values.proposed_code);
    if (typeof values.preview_markup === "string") setPreviewMarkup(values.preview_markup);
    if (Array.isArray(values.component_tree)) setComponentTree(normalizeTree(values.component_tree));
    if (Array.isArray(values.style_controls)) setStyleControls(normalizeControls(values.style_controls));
    if (Array.isArray(values.diff_lines)) setDiffLines(normalizeStrings(values.diff_lines));
    if (typeof values.preview_status === "string") setPreviewStatus(values.preview_status);
    if (Array.isArray(values.preview_errors)) setPreviewErrors(normalizeStrings(values.preview_errors));
    if (Array.isArray(values.sandbox_logs)) setSandboxLogs(normalizeStrings(values.sandbox_logs));
    if (Array.isArray(values.approval_log)) setApprovalLog(normalizeApprovalLog(values.approval_log));
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (Array.isArray(values.version_history)) setVersionHistory(normalizeVersions(values.version_history));
    if (Array.isArray(values.preview_events)) {
      setPreviewEvents((current) => mergePreviewEvents(current, normalizePreviewEvents(values.preview_events)));
    }
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "chat_ui_preview") return;
    setPreviewEvents((current) => mergePreviewEvents(current, normalizePreviewEvents([data])));
  }

  async function streamRun(input: JsonRecord, reuseThreadId = "") {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming preview update" : "Creating UI preview thread");

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

      const stream = await client.runs.stream(nextThreadId, "chat_ui_preview", {
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

  async function runPreview(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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

  return (
    <section className="ui-preview-layout">
      <aside className="ui-preview-control">
        <div className="panel-title">
          <Eye aria-hidden="true" size={18} />
          UI Preview Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <form className="run-form" onSubmit={runPreview}>
          <label className="field">
            <span>UI request</span>
            <textarea value={userRequest} onChange={(event) => setUserRequest(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !userRequest.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run UI preview
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

      <div className={`ui-preview-status-panel ${finalStatus}`} role="region" aria-label="Preview Status">
        <div className="panel-title">Preview Status</div>
        <div className="ui-preview-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Preview</span>
            <strong>{previewStatus}</strong>
          </div>
          <div>
            <span>Component</span>
            <strong>{componentName}</strong>
          </div>
          <div>
            <span>Errors</span>
            <strong>{previewErrors.length}</strong>
          </div>
        </div>
      </div>

      <div className="ui-preview-chat-panel" role="region" aria-label="Chat Transcript">
        <div className="panel-title">Chat Transcript</div>
        <article className="ui-preview-chat-message user">
          <strong>User</strong>
          <p>{userRequest}</p>
        </article>
        <article className="ui-preview-chat-message assistant">
          <strong>Assistant</strong>
          <p>{designSummary || final || "No UI preview yet."}</p>
        </article>
      </div>

      <div className="live-preview-panel" role="region" aria-label="Live Preview">
        <div className="panel-title">Live Preview</div>
        <iframe className="preview-frame" sandbox="" srcDoc={previewDocument(previewMarkup)} title="Sandboxed UI preview" />
        {previewMarkup ? (
          <article className="preview-mirror-card" aria-label="Rendered preview card">
            <p>Generated preview</p>
            <h3>Launch command center</h3>
            <span>{designSummary || "A focused component proposal is ready for review."}</span>
            <div className="preview-mirror-metrics">
              <strong>
                92%
                <small>Readiness</small>
              </strong>
              <strong>
                4
                <small>Owners</small>
              </strong>
              <strong>
                12
                <small>Tasks</small>
              </strong>
            </div>
          </article>
        ) : null}
        <div className="sandbox-log-list">
          {sandboxLogs.length === 0 ? (
            <p className="muted">No sandbox logs yet.</p>
          ) : (
            sandboxLogs.map((log, index) => <code key={`${log}-${index}`}>{log}</code>)
          )}
        </div>
      </div>

      <div className="component-code-panel" role="region" aria-label="Component Code">
        <div className="panel-title">
          <Code2 aria-hidden="true" size={18} />
          Component Code
        </div>
        <pre>{proposedCode || componentCode || "No component code yet."}</pre>
      </div>

      <div className="ui-diff-panel" role="region" aria-label="Diff Preview">
        <div className="panel-title">
          <GitCompare aria-hidden="true" size={18} />
          Diff Preview
        </div>
        <pre>{diffLines.length ? diffLines.join("\n") : "No diff yet."}</pre>
      </div>

      <div className="component-tree-panel" role="region" aria-label="Component Tree">
        <div className="panel-title">Component Tree</div>
        <div className="component-tree-list">
          {componentTree.length === 0 ? (
            <p className="muted">No component tree yet.</p>
          ) : (
            componentTree.map((entry) => (
              <article key={entry.id} className="component-tree-row">
                <strong>{entry.name}</strong>
                <span>{entry.role}</span>
                <p>{entry.detail}</p>
                <code>{entry.id}</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="style-controls-panel" role="region" aria-label="Style Controls">
        <div className="panel-title">
          <SlidersHorizontal aria-hidden="true" size={18} />
          Style Controls
        </div>
        <div className="style-control-list">
          {styleControls.length === 0 ? (
            <p className="muted">No style controls yet.</p>
          ) : (
            styleControls.map((control) => (
              <article key={control.id} className="style-control-row">
                <strong>{control.label}</strong>
                <code>{control.value}</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="ui-approval-panel" role="region" aria-label="Approval Controls">
        <div className="panel-title">Approval Controls</div>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={applyPreview} disabled={!canApprove}>
            <Check size={16} />
            Apply preview
          </button>
          <button type="button" className="secondary-button" onClick={revertPreview} disabled={!canApprove}>
            <Undo2 size={16} />
            Revert preview
          </button>
        </div>
        <div className="approval-log-list">
          {approvalLog.length === 0 ? (
            <p className="muted">{final || "Preview changes require approval before versioning."}</p>
          ) : (
            approvalLog.map((entry, index) => (
              <article key={`${entry.action}-${index}`} className="approval-log-row">
                <strong>{entry.action}</strong>
                <p>{entry.detail}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="ui-version-panel" role="region" aria-label="Version History">
        <div className="panel-title">Version History</div>
        <div className="ui-version-list">
          {versionHistory.length === 0 ? (
            <p className="muted">No applied preview versions yet.</p>
          ) : (
            versionHistory.map((version) => (
              <article key={version.version} className="ui-version-row">
                <strong>v{version.version}</strong>
                <p>{version.summary}</p>
                <code>{version.componentName}</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="ui-preview-events-panel" role="region" aria-label="Preview Events">
        <div className="panel-title">Preview Events</div>
        <div className="ui-preview-event-list">
          {previewEvents.length === 0 ? (
            <p className="muted">No preview events yet.</p>
          ) : (
            previewEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className="ui-preview-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{percent(event.progress)}%</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel ui-preview-final-state" role="region" aria-label="Final State">
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
