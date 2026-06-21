import {
  Activity,
  BarChart3,
  Clock3,
  DollarSign,
  ExternalLink,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";


const toolQuery =
  "Use observability metrics to explain why a LangGraph SDK demo run is slow. Mention latency, tokens, and cost.";
const summaryQuery =
  "Summarize what run metadata, trace links, and raw stream events are useful for debugging a graph.";

type JsonRecord = Record<string, unknown>;

type NodeTiming = {
  node: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  inputKeys: string[];
  outputKeys: string[];
};

type TokenMetric = {
  node: string;
  modelAlias: string;
  modelName: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  usageAvailable: boolean;
};

type CostSummary = {
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalTokens: number | null;
  totalCostUsd: number | null;
  pricingNote: string;
};

type TraceLinks = {
  tracingEnabled: boolean;
  langsmithProject: string;
  langsmithUrl: string;
  note: string;
};

type ObservabilityEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  node: string;
  elapsedMs: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

function formatCount(value: number | null) {
  return value === null ? "unknown" : String(value);
}

function formatCost(value: number | null) {
  return value === null ? "unknown" : `$${value.toFixed(8)}`;
}

function normalizeNodeTimings(value: unknown): NodeTiming[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((timing) => ({
    node: typeof timing.node === "string" ? timing.node : "node",
    status: typeof timing.status === "string" ? timing.status : "",
    startedAt: typeof timing.started_at === "string" ? timing.started_at : "",
    finishedAt: typeof timing.finished_at === "string" ? timing.finished_at : "",
    elapsedMs: typeof timing.elapsed_ms === "number" ? timing.elapsed_ms : 0,
    inputKeys: stringList(timing.input_keys),
    outputKeys: stringList(timing.output_keys),
  }));
}

function normalizeTokenMetrics(value: unknown): TokenMetric[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((metric) => ({
    node: typeof metric.node === "string" ? metric.node : "call_model",
    modelAlias: typeof metric.model_alias === "string" ? metric.model_alias : "",
    modelName: typeof metric.model_name === "string" ? metric.model_name : "",
    inputTokens: numberOrNull(metric.input_tokens),
    outputTokens: numberOrNull(metric.output_tokens),
    totalTokens: numberOrNull(metric.total_tokens),
    costUsd: numberOrNull(metric.cost_usd),
    usageAvailable: typeof metric.usage_available === "boolean" ? metric.usage_available : false,
  }));
}

function normalizeCostSummary(value: unknown): CostSummary {
  const record = isRecord(value) ? value : {};
  return {
    totalInputTokens: numberOrNull(record.total_input_tokens),
    totalOutputTokens: numberOrNull(record.total_output_tokens),
    totalTokens: numberOrNull(record.total_tokens),
    totalCostUsd: numberOrNull(record.total_cost_usd),
    pricingNote: typeof record.pricing_note === "string" ? record.pricing_note : "",
  };
}

function normalizeTraceLinks(value: unknown): TraceLinks {
  const record = isRecord(value) ? value : {};
  return {
    tracingEnabled: typeof record.tracing_enabled === "boolean" ? record.tracing_enabled : false,
    langsmithProject: typeof record.langsmith_project === "string" ? record.langsmith_project : "",
    langsmithUrl: typeof record.langsmith_url === "string" ? record.langsmith_url : "",
    note: typeof record.note === "string" ? record.note : "Trace link unavailable.",
  };
}

function normalizeObservabilityEvents(value: unknown): ObservabilityEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "observability_status",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    node: typeof event.node === "string" ? event.node : "",
    elapsedMs: typeof event.elapsed_ms === "number" ? event.elapsed_ms : 0,
  }));
}

function mergeObservabilityEvents(current: ObservabilityEvent[], next: ObservabilityEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next]
    .filter((event) => {
      const key = `${event.node}:${event.phase}:${event.status}:${event.detail}:${event.elapsedMs}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-80);
}

export function ObservabilityExample() {
  const [query, setQuery] = useState(toolQuery);
  const [threadId, setThreadId] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [nodeTimings, setNodeTimings] = useState<NodeTiming[]>([]);
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetric[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary>(normalizeCostSummary(null));
  const [traceLinks, setTraceLinks] = useState<TraceLinks>(normalizeTraceLinks(null));
  const [runMetadata, setRunMetadata] = useState<JsonRecord | null>(null);
  const [observabilityEvents, setObservabilityEvents] = useState<ObservabilityEvent[]>([]);
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const totalElapsed = nodeTimings.reduce((sum, timing) => sum + timing.elapsedMs, 0);
  const llmCalls = tokenMetrics.length;

  function resetView() {
    setThreadId("");
    setRunId("");
    setStatus("Idle");
    setNodeTimings([]);
    setTokenMetrics([]);
    setCostSummary(normalizeCostSummary(null));
    setTraceLinks(normalizeTraceLinks(null));
    setRunMetadata(null);
    setObservabilityEvents([]);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (typeof values.run_id === "string") setRunId(values.run_id);
    if (Array.isArray(values.node_timings)) setNodeTimings(normalizeNodeTimings(values.node_timings));
    if (Array.isArray(values.token_metrics)) setTokenMetrics(normalizeTokenMetrics(values.token_metrics));
    if (isRecord(values.cost_summary)) setCostSummary(normalizeCostSummary(values.cost_summary));
    if (isRecord(values.trace_links)) setTraceLinks(normalizeTraceLinks(values.trace_links));
    if (isRecord(values.run_metadata)) setRunMetadata(values.run_metadata);
    if (Array.isArray(values.observability_events)) {
      setObservabilityEvents((current) =>
        mergeObservabilityEvents(current, normalizeObservabilityEvents(values.observability_events)),
      );
    }
    if (typeof values.answer === "string") setAnswer(values.answer);
    if (typeof values.final === "string") setFinal(values.final);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "observability_status") return;
    const event = normalizeObservabilityEvents([data])[0];
    setObservabilityEvents((current) => mergeObservabilityEvents(current, [event]));
  }

  async function runObservableGraph(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setNodeTimings([]);
    setTokenMetrics([]);
    setCostSummary(normalizeCostSummary(null));
    setTraceLinks(normalizeTraceLinks(null));
    setRunMetadata(null);
    setObservabilityEvents([]);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setStatus("Creating observability thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "20-observability-ui" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming observable graph");
      const stream = await client.runs.stream(nextThreadId, "20_observability", {
        input: { query: trimmed, run_label: "ui-observable-run" },
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 140));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="observability-layout">
      <aside className="observability-control">
        <div className="panel-title">
          <Activity aria-hidden="true" size={18} />
          Observable Run
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => setQuery(toolQuery)} disabled={busy}>
            <Clock3 size={16} />
            Use tool query
          </button>
          <button type="button" className="secondary-button" onClick={() => setQuery(summaryQuery)} disabled={busy}>
            <BarChart3 size={16} />
            Use summary query
          </button>
        </div>
        <form className="run-form" onSubmit={runObservableGraph}>
          <label className="field">
            <span>Observable query</span>
            <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !query.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run observable graph
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
            <span>Run ID</span>
            <strong>{runId || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className="run-metrics-panel" role="region" aria-label="Run Metrics">
        <div className="panel-title">Run Metrics</div>
        <div className="metric-grid">
          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span>Total Latency</span>
            <strong>{totalElapsed.toFixed(2)}ms</strong>
          </div>
          <div>
            <span>Nodes</span>
            <strong>{nodeTimings.length}</strong>
          </div>
          <div>
            <span>LLM Calls</span>
            <strong>{llmCalls}</strong>
          </div>
          <div>
            <span>Total Tokens</span>
            <strong>{formatCount(costSummary.totalTokens)}</strong>
          </div>
        </div>
      </div>

      <div className="node-timings-panel" role="region" aria-label="Node Timings">
        <div className="panel-title">Node Timings</div>
        <div className="node-timing-list">
          {nodeTimings.length === 0 ? (
            <p className="muted">Run the graph to see node latency rows.</p>
          ) : (
            nodeTimings.map((timing) => (
              <article key={`${timing.node}-${timing.startedAt}`} className="node-timing-row">
                <strong>{timing.node}</strong>
                <code>{timing.status}</code>
                <span>{timing.elapsedMs.toFixed(2)}ms</span>
                <small>in: {timing.inputKeys.join(", ") || "none"}</small>
                <small>out: {timing.outputKeys.join(", ") || "none"}</small>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="token-usage-panel" role="region" aria-label="Token Usage">
        <div className="panel-title">Token Usage</div>
        <div className="token-table">
          {tokenMetrics.length === 0 ? (
            <p className="muted">Token metadata is unknown until the LLM call completes.</p>
          ) : (
            tokenMetrics.map((metric) => (
              <article key={`${metric.node}-${metric.modelName}`} className="token-row">
                <strong>{metric.node}</strong>
                <span>{metric.modelAlias || metric.modelName}</span>
                <code>input {formatCount(metric.inputTokens)}</code>
                <code>output {formatCount(metric.outputTokens)}</code>
                <code>total {formatCount(metric.totalTokens)}</code>
                <small>{metric.usageAvailable ? "usage available" : "usage unknown"}</small>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="cost-estimate-panel" role="region" aria-label="Cost Estimate">
        <div className="panel-title">
          <DollarSign aria-hidden="true" size={18} />
          Cost Estimate
        </div>
        <div className="cost-card">
          <span>Total input tokens</span>
          <strong>{formatCount(costSummary.totalInputTokens)}</strong>
          <span>Total output tokens</span>
          <strong>{formatCount(costSummary.totalOutputTokens)}</strong>
          <span>Estimated cost</span>
          <strong>{formatCost(costSummary.totalCostUsd)}</strong>
        </div>
        <p className="muted">{costSummary.pricingNote || "Missing token data is displayed as unknown."}</p>
      </div>

      <div className="trace-links-panel" role="region" aria-label="Trace Links">
        <div className="panel-title">Trace Links</div>
        {traceLinks.tracingEnabled && traceLinks.langsmithUrl ? (
          <a className="trace-link" href={traceLinks.langsmithUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            Open LangSmith trace
          </a>
        ) : (
          <p className="muted">Trace link unavailable.</p>
        )}
        <pre>{formatJson(traceLinks)}</pre>
      </div>

      <div className="run-metadata-panel" role="region" aria-label="Run Metadata">
        <div className="panel-title">Run Metadata</div>
        <pre>{runMetadata ? formatJson(runMetadata) : "No run metadata yet."}</pre>
      </div>

      <div className="observability-events-panel" role="region" aria-label="Observability Events">
        <div className="panel-title">Observability Events</div>
        <div className="observability-event-list">
          {observabilityEvents.length === 0 ? (
            <p className="muted">Custom observability events will appear here.</p>
          ) : (
            observabilityEvents.map((event, index) => (
              <article key={`${event.node}-${event.phase}-${index}`} className={`observability-event ${event.status}`}>
                <strong>{event.node}</strong>
                <code>{event.phase}</code>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <small>{event.elapsedMs.toFixed(2)}ms</small>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box compact-answer">{final || answer || "No final answer yet."}</div>
      </div>

      <div className="state-panel observability-final-state" role="region" aria-label="Final State">
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
