import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { toolQuery, type JsonRecord, type NodeTiming, type TokenMetric, type CostSummary, type TraceLinks, type ObservabilityEvent, normalizeNodeTimings, normalizeTokenMetrics, normalizeCostSummary, normalizeTraceLinks, normalizeObservabilityEvents, mergeObservabilityEvents } from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useObservabilityState() {
  const [query, setQuery] = useState(toolQuery);
  const [threadId, setThreadId] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [nodeTimings, setNodeTimings] = useState<NodeTiming[]>([]);
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetric[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary>(
    normalizeCostSummary(null),
  );
  const [traceLinks, setTraceLinks] = useState<TraceLinks>(
    normalizeTraceLinks(null),
  );
  const [runMetadata, setRunMetadata] = useState<JsonRecord | null>(null);
  const [observabilityEvents, setObservabilityEvents] = useState<
    ObservabilityEvent[]
  >([]);
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const totalElapsed = nodeTimings.reduce(
    (sum, timing) => sum + timing.elapsedMs,
    0,
  );

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
    if (R.isString(values.run_id)) setRunId(values.run_id);
    if (R.isArray(values.node_timings))
      setNodeTimings(normalizeNodeTimings(values.node_timings));
    if (R.isArray(values.token_metrics))
      setTokenMetrics(normalizeTokenMetrics(values.token_metrics));
    if (R.isPlainObject(values.cost_summary))
      setCostSummary(normalizeCostSummary(values.cost_summary));
    if (R.isPlainObject(values.trace_links))
      setTraceLinks(normalizeTraceLinks(values.trace_links));
    if (R.isPlainObject(values.run_metadata)) setRunMetadata(values.run_metadata);
    if (R.isArray(values.observability_events)) {
      setObservabilityEvents((current) =>
        mergeObservabilityEvents(
          current,
          normalizeObservabilityEvents(values.observability_events),
        ),
      );
    }
    if (R.isString(values.answer)) setAnswer(values.answer);
    if (R.isString(values.final)) setFinal(values.final);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "observability_status") return;
    const event = normalizeObservabilityEvents([data])[0];
    setObservabilityEvents((current) =>
      mergeObservabilityEvents(current, [event]),
    );
  }

  function prepareRunObservableGraph() {
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
  }

  return {
    query,
    setQuery,
    threadId,
    setThreadId,
    runId,
    status,
    setStatus,
    nodeTimings,
    tokenMetrics,
    costSummary,
    traceLinks,
    runMetadata,
    observabilityEvents,
    answer,
    final,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    totalElapsed,
    llmCalls,
    resetView,
    applyValues,
    applyCustomEvent,
    prepareRunObservableGraph,
  };
}
