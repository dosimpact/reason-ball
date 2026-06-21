import { GitFork, Loader2, Play, RotateCcw, Route } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();

const samples = [
  {
    label: "Summary",
    value:
      "Summarize this release note in one sentence: LangGraph adds checkpoint replay and clearer SDK stream events for debugging.",
  },
  {
    label: "Translation",
    value: "Translate this to Korean: The deployment finished successfully.",
  },
  {
    label: "Support",
    value: "Customer reports a timeout after clicking deploy and needs a triage next step.",
  },
];

type BranchName = "translation" | "summary" | "support";
type BranchStatus = "pending" | "selected" | "done" | "skipped";

type BranchCard = {
  name: BranchName;
  label: string;
  status: BranchStatus;
  reason: string;
};

type JsonRecord = Record<string, unknown>;

const branchOrder: BranchCard[] = [
  { name: "translation", label: "Translation Branch", status: "pending", reason: "Waiting" },
  { name: "summary", label: "Summary Branch", status: "pending", reason: "Waiting" },
  { name: "support", label: "Support Branch", status: "pending", reason: "Waiting" },
];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function normalizeBranchStatuses(value: unknown): BranchCard[] {
  if (!Array.isArray(value)) return branchOrder;
  const byName = new Map<string, JsonRecord>();
  for (const item of value) {
    if (isRecord(item) && typeof item.name === "string") byName.set(item.name, item);
  }
  return branchOrder.map((branch) => {
    const record = byName.get(branch.name);
    if (!record) return branch;
    const status =
      record.status === "selected" || record.status === "done" || record.status === "skipped"
        ? record.status
        : branch.status;
    return {
      ...branch,
      label: typeof record.label === "string" ? record.label : branch.label,
      status,
      reason: typeof record.reason === "string" ? record.reason : branch.reason,
    };
  });
}

function updateFromValues(values: JsonRecord, setBranches: (branches: BranchCard[]) => void) {
  if (values.branch_statuses) {
    setBranches(normalizeBranchStatuses(values.branch_statuses));
  }
}

function nodePayload(data: unknown, nodeName: string): JsonRecord | null {
  if (!isRecord(data)) return null;
  const payload = data[nodeName];
  return isRecord(payload) ? payload : null;
}

export function ConditionalRoutingExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [request, setRequest] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [routeReason, setRouteReason] = useState("");
  const [skippedBranches, setSkippedBranches] = useState<string[]>([]);
  const [branches, setBranches] = useState<BranchCard[]>(branchOrder);
  const [branchResult, setBranchResult] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setSelectedBranch("");
    setRouteReason("");
    setSkippedBranches([]);
    setBranches(branchOrder);
    setBranchResult("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (typeof values.selected_branch === "string") {
      setSelectedBranch(values.selected_branch);
    }
    if (typeof values.route_reason === "string") {
      setRouteReason(values.route_reason);
    }
    if (Array.isArray(values.skipped_branches)) {
      setSkippedBranches(values.skipped_branches.map(String));
    }
    if (typeof values.branch_result === "string") {
      setBranchResult(values.branch_result);
    }
    updateFromValues(values, setBranches);
  }

  async function runRoute(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = request.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setSelectedBranch("");
    setRouteReason("");
    setSkippedBranches([]);
    setBranches(branchOrder);
    setBranchResult("");
    setFinalState(null);
    setStatus("Creating route thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "09-conditional-routing-ui", request: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming route decision");

      const stream = await client.runs.stream(nextThreadId, "conditional_routing", {
        input: { request: trimmed },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 100));
        for (const nodeName of [
          "route_request",
          "translation_branch",
          "summary_branch",
          "support_branch",
          "finalize",
        ]) {
          const payload = nodePayload(logEntry.data, nodeName);
          if (payload) applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      setFinalState(values);
      applyValues(values);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="routing-layout">
      <aside className="routing-control">
        <div className="panel-title">
          <Route aria-hidden="true" size={18} />
          Routing Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="sample-list" aria-label="Routing samples">
          {samples.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="sample-button"
              onClick={() => setRequest(sample.value)}
              disabled={busy}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <form onSubmit={runRoute} className="run-form">
          <label className="field">
            <span>Request</span>
            <textarea value={request} onChange={(event) => setRequest(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !request.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run conditional route
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
            <span>Selected</span>
            <strong>{selectedBranch || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className="routing-decision-panel" role="region" aria-label="Route Decision">
        <div className="panel-title">
          <GitFork aria-hidden="true" size={18} />
          Route Decision
        </div>
        {selectedBranch ? (
          <div className="route-decision-card">
            <span>Selected branch</span>
            <strong>{selectedBranch}</strong>
            <span>Routing reason</span>
            <p>{routeReason}</p>
            <span>Skipped branches</span>
            <p>{skippedBranches.length ? skippedBranches.join(", ") : "none"}</p>
          </div>
        ) : (
          <p className="muted">Run a request to see the conditional edge decision.</p>
        )}
      </div>

      <div className="branch-map-panel" role="region" aria-label="Branch Map">
        <div className="panel-title">Branch Map</div>
        <div className="branch-card-grid">
          {branches.map((branch) => (
            <article key={branch.name} className={`branch-card ${branch.status}`}>
              <div className="branch-card-header">
                <strong>{branch.label}</strong>
                <span>{branch.status === "done" ? "selected done" : branch.status}</span>
              </div>
              <code>{branch.name}</code>
              <p>{branch.reason}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="result-panel routing-result" role="region" aria-label="Branch Result">
        <div className="panel-title">Branch Result</div>
        <div className="answer-box">{branchResult || "No branch result yet."}</div>
      </div>

      <div className="state-panel routing-state" role="region" aria-label="Final State">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? JSON.stringify(finalState, null, 2) : "No final state yet."}</pre>
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
                  <strong>{entry.event}</strong>
                </summary>
                <pre>{JSON.stringify(entry.data, null, 2)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
