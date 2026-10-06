import { DollarSign, ExternalLink } from "lucide-react";
import { formatJson, formatCount, formatCost } from "./data";
import { type ObservabilityController } from "./useObservability";

// Typed display panels receive only the state and callbacks they render.
type RunMetricsPanelProps = Pick<
  ObservabilityController,
  "status" | "nodeTimings" | "costSummary" | "totalElapsed" | "llmCalls"
>;

export function RunMetricsPanel({
  status,
  nodeTimings,
  costSummary,
  totalElapsed,
  llmCalls,
}: RunMetricsPanelProps) {
  return (
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
  );
}

type NodeTimingsPanelProps = Pick<
  ObservabilityController,
  "status" | "nodeTimings"
>;

export function NodeTimingsPanel({
  status,
  nodeTimings,
}: NodeTimingsPanelProps) {
  return (
    <div className="node-timings-panel" role="region" aria-label="Node Timings">
      <div className="panel-title">Node Timings</div>
      <div className="node-timing-list">
        {nodeTimings.length === 0 ? (
          <p className="muted">Run the graph to see node latency rows.</p>
        ) : (
          nodeTimings.map((timing) => (
            <article
              key={`${timing.node}-${timing.startedAt}`}
              className="node-timing-row"
            >
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
  );
}

type TokenUsagePanelProps = Pick<ObservabilityController, "tokenMetrics">;

export function TokenUsagePanel({ tokenMetrics }: TokenUsagePanelProps) {
  return (
    <div className="token-usage-panel" role="region" aria-label="Token Usage">
      <div className="panel-title">Token Usage</div>
      <div className="token-table">
        {tokenMetrics.length === 0 ? (
          <p className="muted">
            Token metadata is unknown until the LLM call completes.
          </p>
        ) : (
          tokenMetrics.map((metric) => (
            <article
              key={`${metric.node}-${metric.modelName}`}
              className="token-row"
            >
              <strong>{metric.node}</strong>
              <span>{metric.modelAlias || metric.modelName}</span>
              <code>input {formatCount(metric.inputTokens)}</code>
              <code>output {formatCount(metric.outputTokens)}</code>
              <code>total {formatCount(metric.totalTokens)}</code>
              <small>
                {metric.usageAvailable ? "usage available" : "usage unknown"}
              </small>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type CostEstimatePanelProps = Pick<ObservabilityController, "costSummary">;

export function CostEstimatePanel({ costSummary }: CostEstimatePanelProps) {
  return (
    <div
      className="cost-estimate-panel"
      role="region"
      aria-label="Cost Estimate"
    >
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
      <p className="muted">
        {costSummary.pricingNote ||
          "Missing token data is displayed as unknown."}
      </p>
    </div>
  );
}

type TraceLinksPanelProps = Pick<ObservabilityController, "traceLinks">;

export function TraceLinksPanel({ traceLinks }: TraceLinksPanelProps) {
  return (
    <div className="trace-links-panel" role="region" aria-label="Trace Links">
      <div className="panel-title">Trace Links</div>
      {traceLinks.tracingEnabled && traceLinks.langsmithUrl ? (
        <a
          className="trace-link"
          href={traceLinks.langsmithUrl}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} />
          Open LangSmith trace
        </a>
      ) : (
        <p className="muted">Trace link unavailable.</p>
      )}
      <pre>{formatJson(traceLinks)}</pre>
    </div>
  );
}

type RunMetadataPanelProps = Pick<ObservabilityController, "runMetadata">;

export function RunMetadataPanel({ runMetadata }: RunMetadataPanelProps) {
  return (
    <div className="run-metadata-panel" role="region" aria-label="Run Metadata">
      <div className="panel-title">Run Metadata</div>
      <pre>
        {runMetadata ? formatJson(runMetadata) : "No run metadata yet."}
      </pre>
    </div>
  );
}

type ObservabilityEventsPanelProps = Pick<
  ObservabilityController,
  "status" | "observabilityEvents"
>;

export function ObservabilityEventsPanel({
  status,
  observabilityEvents,
}: ObservabilityEventsPanelProps) {
  return (
    <div
      className="observability-events-panel"
      role="region"
      aria-label="Observability Events"
    >
      <div className="panel-title">Observability Events</div>
      <div className="observability-event-list">
        {observabilityEvents.length === 0 ? (
          <p className="muted">Custom observability events will appear here.</p>
        ) : (
          observabilityEvents.map((event, index) => (
            <article
              key={`${event.node}-${event.phase}-${index}`}
              className={`observability-event ${event.status}`}
            >
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
  );
}

type FinalAnswerPanelProps = Pick<ObservabilityController, "answer" | "final">;

export function FinalAnswerPanel({ answer, final }: FinalAnswerPanelProps) {
  return (
    <div className="final-answer-panel" role="region" aria-label="Final Answer">
      <div className="panel-title">Final Answer</div>
      <div className="answer-box compact-answer">
        {final || answer || "No final answer yet."}
      </div>
    </div>
  );
}
