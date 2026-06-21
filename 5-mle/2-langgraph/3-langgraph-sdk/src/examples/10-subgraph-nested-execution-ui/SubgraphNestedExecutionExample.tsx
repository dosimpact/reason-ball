import { ChevronRight, GitBranch, Layers3, Loader2, Play, RotateCcw } from "lucide-react";
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
    label: "Sales Report",
    value:
      "Analyze last quarter sales data and draft an executive summary with the key growth driver and next action.",
  },
  {
    label: "Writing Sample",
    value: "Rewrite this customer email to sound concise, professional, and ready to send.",
  },
  {
    label: "Analysis Brief",
    value:
      "Use the revenue metrics to explain why enterprise expansion changed the forecast.",
  },
];

type JsonRecord = Record<string, unknown>;

type StepRecord = {
  id: string;
  level: string;
  path: string[];
  node: string;
  label: string;
  status: string;
  summary: string;
};

type MessageRecord = {
  path: string;
  role: string;
  content: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function normalizeSteps(value: unknown): StepRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((record, index) => ({
      id: typeof record.id === "string" ? record.id : `step-${index + 1}`,
      level: typeof record.level === "string" ? record.level : "nested",
      path: Array.isArray(record.path) ? record.path.map(String) : [],
      node: typeof record.node === "string" ? record.node : `node-${index + 1}`,
      label: typeof record.label === "string" ? record.label : `Step ${index + 1}`,
      status: typeof record.status === "string" ? record.status : "done",
      summary: typeof record.summary === "string" ? record.summary : "",
    }));
}

function normalizeMessages(value: unknown): MessageRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((record) => ({
      path: typeof record.path === "string" ? record.path : "unknown",
      role: typeof record.role === "string" ? record.role : "node",
      content: typeof record.content === "string" ? record.content : JSON.stringify(record),
    }));
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function namespaceFromEvent(event: string) {
  const [, namespace] = event.split("|");
  return namespace ?? "parent";
}

function applyValues(
  values: JsonRecord,
  setters: {
    setSelectedTeam: (value: string) => void;
    setBreadcrumb: (value: string[]) => void;
    setParentSteps: (value: StepRecord[]) => void;
    setSubgraphSteps: (value: StepRecord[]) => void;
    setParentMessages: (value: MessageRecord[]) => void;
    setSubgraphMessages: (value: MessageRecord[]) => void;
    setParentState: (value: JsonRecord | null) => void;
    setSubgraphState: (value: JsonRecord | null) => void;
    setFinalState: (value: JsonRecord | null) => void;
    setFinal: (value: string) => void;
  },
) {
  if (typeof values.selected_team === "string") setters.setSelectedTeam(values.selected_team);
  if (Array.isArray(values.breadcrumb)) setters.setBreadcrumb(values.breadcrumb.map(String));
  if (Array.isArray(values.parent_steps)) setters.setParentSteps(normalizeSteps(values.parent_steps));
  if (Array.isArray(values.subgraph_steps)) {
    setters.setSubgraphSteps(normalizeSteps(values.subgraph_steps));
  }
  if (Array.isArray(values.parent_messages)) {
    setters.setParentMessages(normalizeMessages(values.parent_messages));
  }
  if (Array.isArray(values.subgraph_messages)) {
    setters.setSubgraphMessages(normalizeMessages(values.subgraph_messages));
  }
  if (isRecord(values.parent_state)) setters.setParentState(values.parent_state);
  if (isRecord(values.subgraph_state)) setters.setSubgraphState(values.subgraph_state);
  if (typeof values.final === "string") setters.setFinal(values.final);
  if (Object.keys(values).length > 0) setters.setFinalState(values);
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

export function SubgraphNestedExecutionExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [request, setRequest] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [parentSteps, setParentSteps] = useState<StepRecord[]>([]);
  const [subgraphSteps, setSubgraphSteps] = useState<StepRecord[]>([]);
  const [parentMessages, setParentMessages] = useState<MessageRecord[]>([]);
  const [subgraphMessages, setSubgraphMessages] = useState<MessageRecord[]>([]);
  const [parentState, setParentState] = useState<JsonRecord | null>(null);
  const [subgraphState, setSubgraphState] = useState<JsonRecord | null>(null);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [final, setFinal] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
  const setters = {
    setSelectedTeam,
    setBreadcrumb,
    setParentSteps,
    setSubgraphSteps,
    setParentMessages,
    setSubgraphMessages,
    setParentState,
    setSubgraphState,
    setFinalState,
    setFinal,
  };

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setSelectedTeam("");
    setBreadcrumb([]);
    setParentSteps([]);
    setSubgraphSteps([]);
    setParentMessages([]);
    setSubgraphMessages([]);
    setParentState(null);
    setSubgraphState(null);
    setFinalState(null);
    setFinal("");
    setEvents([]);
    setError("");
  }

  async function runNestedGraph(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = request.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setSelectedTeam("");
    setBreadcrumb([]);
    setParentSteps([]);
    setSubgraphSteps([]);
    setParentMessages([]);
    setSubgraphMessages([]);
    setParentState(null);
    setSubgraphState(null);
    setFinalState(null);
    setFinal("");
    setStatus("Creating nested thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "10-subgraph-nested-execution-ui", request: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming parent and subgraph updates");

      const stream = await client.runs.stream(nextThreadId, "subgraph_nested_execution", {
        input: { request: trimmed },
        streamMode: "updates",
        streamSubgraphs: true,
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        const namespace = namespaceFromEvent(logEntry.event);
        setEvents((current) => [logEntry, ...current].slice(0, 120));
        for (const payload of nodePayloads(logEntry.data)) {
          applyValues(payload, setters);
        }
        setStatus(`Streaming ${namespace}: ${logEntry.event.split("|")[0]}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      applyValues(values, setters);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="nested-layout">
      <aside className="nested-control">
        <div className="panel-title">
          <Layers3 aria-hidden="true" size={18} />
          Nested Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="sample-list" aria-label="Nested samples">
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
        <form onSubmit={runNestedGraph} className="run-form">
          <label className="field">
            <span>Request</span>
            <textarea value={request} onChange={(event) => setRequest(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !request.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run nested graph
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
            <span>Team</span>
            <strong>{selectedTeam || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className="breadcrumb-panel" role="region" aria-label="Breadcrumb">
        <div className="panel-title">
          <GitBranch aria-hidden="true" size={18} />
          Breadcrumb
        </div>
        <div className="breadcrumb-list">
          {(breadcrumb.length ? breadcrumb : ["parent", "subgraph", "worker"]).map((item, index) => (
            <span key={`${item}-${index}`} className="breadcrumb-chip">
              {index > 0 ? <ChevronRight aria-hidden="true" size={14} /> : null}
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="nested-tree-panel" role="region" aria-label="Nested Execution Tree">
        <div className="panel-title">Nested Execution Tree</div>
        <div className="nested-tree">
          {parentSteps.length === 0 ? (
            <p className="muted">Run a request to see parent and subgraph execution.</p>
          ) : (
            <>
              <div className="tree-node parent">
                <strong>Parent supervisor</strong>
                <span>parent</span>
              </div>
              {parentSteps.map((step) => (
                <article key={step.id} className="tree-node parent">
                  <strong>{step.label}</strong>
                  <code>{step.path.join(" > ")}</code>
                  <p>{step.summary}</p>
                </article>
              ))}
              <details className="nested-tree-group" open>
                <summary>
                  <strong>{selectedTeam || "subgraph team"}</strong>
                  <span>{subgraphSteps.length} worker steps</span>
                </summary>
                <div className="tree-children">
                  {subgraphSteps.map((step) => (
                    <article key={step.id} className={`tree-node ${step.level}`}>
                      <strong>{step.label}</strong>
                      <code>{step.path.join(" > ")}</code>
                      <p>{step.summary}</p>
                    </article>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      <div className="nested-state-panel" role="region" aria-label="Parent State">
        <div className="panel-title">Parent State</div>
        <pre>
          {parentState
            ? formatJson({ parent_state: parentState, parent_messages: parentMessages })
            : "No parent state yet."}
        </pre>
      </div>

      <div className="subgraph-state-panel" role="region" aria-label="Subgraph State">
        <div className="panel-title">Subgraph State</div>
        <details open>
          <summary>Subgraph details: team and worker state</summary>
          <pre>
            {subgraphState
              ? formatJson({ subgraph_state: subgraphState, subgraph_messages: subgraphMessages })
              : "No subgraph state yet."}
          </pre>
        </details>
      </div>

      <div className="result-panel nested-result" role="region" aria-label="Nested Result">
        <div className="panel-title">Nested Result</div>
        <div className="answer-box">{final || "No nested result yet."}</div>
      </div>

      <div className="state-panel nested-final-state" role="region" aria-label="Final State">
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
                  <strong>{entry.event}</strong>
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
