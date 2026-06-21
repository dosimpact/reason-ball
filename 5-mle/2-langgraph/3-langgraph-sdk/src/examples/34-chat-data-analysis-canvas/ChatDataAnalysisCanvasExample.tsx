import {
  BarChart3,
  Code2,
  Database,
  Lightbulb,
  Loader2,
  Play,
  RefreshCcw,
  RotateCcw,
  SquareTerminal,
  Table2,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultRequest =
  "Analyze conversion by channel, identify the strongest segment, and produce a compact chart and retry-safe sandbox log.";
const defaultCsv = `channel,visitors,signups,revenue
Organic,4200,504,30240
Paid Search,3100,279,19530
Referral,1800,252,17640
Email,2400,384,26880
Partner,950,171,13680`;

type JsonRecord = Record<string, unknown>;

type DatasetColumn = {
  name: string;
  type: string;
  nullable: boolean;
};

type TableCell = string | number | boolean | null;
type TableRow = Record<string, TableCell>;

type AnalysisStep = {
  id: string;
  label: string;
  status: string;
  detail: string;
};

type ChartDatum = {
  label: string;
  value: number;
  color: string;
};

type ChartSpec = {
  title: string;
  metric: string;
  kind: string;
  data: ChartDatum[];
};

type AnalysisEvent = {
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

function normalizeColumns(value: unknown): DatasetColumn[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((column) => ({
    name: typeof column.name === "string" ? column.name : "",
    type:
      typeof column.type === "string"
        ? column.type
        : typeof column.inferred_type === "string"
          ? column.inferred_type
          : "string",
    nullable: Boolean(column.nullable),
  }));
}

function normalizeRows(value: unknown): TableRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((row) => {
    const next: TableRow = {};
    for (const [key, cell] of Object.entries(row)) {
      if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean" || cell === null) {
        next[key] = cell;
      } else {
        next[key] = String(cell);
      }
    }
    return next;
  });
}

function normalizeSteps(value: unknown): AnalysisStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((step, index) => ({
    id: typeof step.id === "string" ? step.id : `step-${index + 1}`,
    label:
      typeof step.label === "string"
        ? step.label
        : typeof step.title === "string"
          ? step.title
          : typeof step.name === "string"
            ? step.name
            : `Step ${index + 1}`,
    status: typeof step.status === "string" ? step.status : "pending",
    detail: typeof step.detail === "string" ? step.detail : "",
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

function normalizeChartSpecs(value: unknown): ChartSpec[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((chart) => ({
    title: typeof chart.title === "string" ? chart.title : "Analysis chart",
    metric: typeof chart.metric === "string" ? chart.metric : typeof chart.y === "string" ? chart.y : "value",
    kind: typeof chart.kind === "string" ? chart.kind : "bar",
    data: Array.isArray(chart.data)
      ? chart.data.filter(isRecord).map((datum, index) => ({
          label: typeof datum.label === "string" ? datum.label : `Row ${index + 1}`,
          value:
            typeof datum.value === "number"
              ? datum.value
              : typeof chart.y === "string" && typeof datum[chart.y] === "number"
                ? Number(datum[chart.y])
                : numberValue(datum.value),
          color: typeof datum.color === "string" ? datum.color : "#0f766e",
        }))
      : [],
  }));
}

function rowsFromResultTable(value: unknown): TableRow[] {
  if (isRecord(value) && Array.isArray(value.rows)) return normalizeRows(value.rows);
  return normalizeRows(value);
}

function normalizeEvents(value: unknown): AnalysisEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "chat_data_analysis_canvas",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    progress: numberValue(event.progress),
  }));
}

function mergeEvents(current: AnalysisEvent[], next: AnalysisEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.progress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tableColumns(rows: TableRow[], columns: DatasetColumn[]) {
  const fromSchema = columns.map((column) => column.name).filter(Boolean);
  if (fromSchema.length > 0) return fromSchema;
  return Object.keys(rows[0] ?? {});
}

export function ChatDataAnalysisCanvasExample() {
  const [userRequest, setUserRequest] = useState(defaultRequest);
  const [csvText, setCsvText] = useState(defaultCsv);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [datasetName, setDatasetName] = useState("campaign_metrics.csv");
  const [rowCount, setRowCount] = useState(0);
  const [columns, setColumns] = useState<DatasetColumn[]>([]);
  const [previewRows, setPreviewRows] = useState<TableRow[]>([]);
  const [generatedCode, setGeneratedCode] = useState("");
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([]);
  const [executionStatus, setExecutionStatus] = useState("idle");
  const [retryCount, setRetryCount] = useState(0);
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([]);
  const [executionErrors, setExecutionErrors] = useState<string[]>([]);
  const [chartSpecs, setChartSpecs] = useState<ChartSpec[]>([]);
  const [resultTable, setResultTable] = useState<TableRow[]>([]);
  const [insightSummary, setInsightSummary] = useState("");
  const [analysisEvents, setAnalysisEvents] = useState<AnalysisEvent[]>([]);
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const canRetry = Boolean(threadId) && !busy;
  const resultColumns = tableColumns(resultTable, []);
  const previewColumns = tableColumns(previewRows, columns);
  const chart = chartSpecs[0] ?? null;
  const chartMax = Math.max(1, ...(chart?.data.map((datum) => datum.value) ?? [1]));

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setDatasetName("campaign_metrics.csv");
    setRowCount(0);
    setColumns([]);
    setPreviewRows([]);
    setGeneratedCode("");
    setAnalysisSteps([]);
    setExecutionStatus("idle");
    setRetryCount(0);
    setSandboxLogs([]);
    setExecutionErrors([]);
    setChartSpecs([]);
    setResultTable([]);
    setInsightSummary("");
    setAnalysisEvents([]);
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (typeof values.dataset_name === "string") setDatasetName(values.dataset_name);
    if (isRecord(values.dataset_metadata)) {
      const metadata = values.dataset_metadata;
      if (typeof metadata.row_count === "number") setRowCount(metadata.row_count);
      if (typeof metadata.source === "string") setDatasetName(`${metadata.source} dataset`);
    }
    if (typeof values.row_count === "number") setRowCount(values.row_count);
    if (Array.isArray(values.columns)) setColumns(normalizeColumns(values.columns));
    if (Array.isArray(values.parsed_columns)) setColumns(normalizeColumns(values.parsed_columns));
    if (Array.isArray(values.preview_rows)) setPreviewRows(normalizeRows(values.preview_rows));
    if (typeof values.generated_code === "string") setGeneratedCode(values.generated_code);
    if (Array.isArray(values.analysis_steps)) setAnalysisSteps(normalizeSteps(values.analysis_steps));
    if (typeof values.execution_status === "string") setExecutionStatus(values.execution_status);
    if (typeof values.retry_count === "number") setRetryCount(values.retry_count);
    if (Array.isArray(values.sandbox_logs)) setSandboxLogs(normalizeStrings(values.sandbox_logs));
    if (Array.isArray(values.execution_errors)) setExecutionErrors(normalizeStrings(values.execution_errors));
    if (Array.isArray(values.chart_specs)) setChartSpecs(normalizeChartSpecs(values.chart_specs));
    if (values.result_table !== undefined) setResultTable(rowsFromResultTable(values.result_table));
    if (typeof values.insight_summary === "string") setInsightSummary(values.insight_summary);
    if (Array.isArray(values.analysis_events)) {
      setAnalysisEvents((current) => mergeEvents(current, normalizeEvents(values.analysis_events)));
    }
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) {
      setFinalState((current) => ({ ...(current ?? {}), ...values }));
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "chat_data_analysis_canvas") return;
    setAnalysisEvents((current) => mergeEvents(current, normalizeEvents([data])));
  }

  async function streamRun(input: JsonRecord, reuseThreadId = "") {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming analysis update" : "Creating data analysis thread");

    try {
      const nextThreadId =
        reuseThreadId ||
        String(
          (
            await client.threads.create({
              metadata: { example: "34-chat-data-analysis-canvas" },
            })
          ).thread_id,
        );
      setThreadId(nextThreadId);
      setStatus("Streaming data analysis graph");

      const stream = await client.runs.stream(nextThreadId, "34_chat_data_analysis_canvas", {
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

  async function runAnalysis(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const request = userRequest.trim();
    const csv = csvText.trim();
    if (!request || !csv) return;
    resetView();
    setFinalStatus("running");
    await streamRun({
      user_request: request,
      csv_text: csv,
      dataset_name: datasetName,
      action: "analyze",
    });
  }

  async function retryAnalysis() {
    if (!threadId) return;
    await streamRun({ action: "retry" }, threadId);
  }

  return (
    <section className="data-canvas-layout">
      <aside className="data-canvas-control">
        <div className="panel-title">
          <Database aria-hidden="true" size={18} />
          Data Canvas Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form className="run-form" onSubmit={runAnalysis}>
          <label className="field">
            <span>Analysis request</span>
            <textarea value={userRequest} onChange={(event) => setUserRequest(event.target.value)} rows={4} />
          </label>
          <label className="field">
            <span>Dataset name</span>
            <input value={datasetName} onChange={(event) => setDatasetName(event.target.value)} />
          </label>
          <label className="field">
            <span>CSV data</span>
            <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={7} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !userRequest.trim() || !csvText.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run analysis
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
            <span>Retries</span>
            <strong>{retryCount}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`data-canvas-status-panel ${finalStatus}`} role="region" aria-label="Analysis Status">
        <div className="panel-title">Analysis Status</div>
        <div className="data-canvas-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Execution</span>
            <strong>{executionStatus}</strong>
          </div>
          <div>
            <span>Rows</span>
            <strong>{rowCount}</strong>
          </div>
          <div>
            <span>Errors</span>
            <strong>{executionErrors.length}</strong>
          </div>
        </div>
      </div>

      <div className="data-chat-panel" role="region" aria-label="Chat Transcript">
        <div className="panel-title">Chat Transcript</div>
        <article className="data-chat-message user">
          <strong>User</strong>
          <p>{userRequest}</p>
        </article>
        <article className="data-chat-message assistant">
          <strong>Assistant</strong>
          <p>{insightSummary || final || "No data analysis yet."}</p>
        </article>
      </div>

      <div className="dataset-preview-panel" role="region" aria-label="Dataset Preview">
        <div className="panel-title">
          <Table2 aria-hidden="true" size={18} />
          Dataset Preview
        </div>
        <div className="dataset-meta-row">
          <strong>{datasetName}</strong>
          <span>{rowCount} rows</span>
          <span>{columns.length} columns</span>
        </div>
        <div className="data-table-scroll">
          <table>
            <thead>
              <tr>
                {previewColumns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.length === 0 ? (
                <tr>
                  <td>No parsed rows yet.</td>
                </tr>
              ) : (
                previewRows.map((row, index) => (
                  <tr key={index}>
                    {previewColumns.map((column) => (
                      <td key={column}>{String(row[column] ?? "")}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="column-chip-list">
          {columns.map((column) => (
            <code key={column.name}>{column.name}:{column.type}</code>
          ))}
        </div>
      </div>

      <div className="analysis-code-panel" role="region" aria-label="Generated Code">
        <div className="panel-title">
          <Code2 aria-hidden="true" size={18} />
          Generated Code
        </div>
        <pre>{generatedCode || "No generated analysis code yet."}</pre>
      </div>

      <div className="result-table-panel" role="region" aria-label="Result Table">
        <div className="panel-title">
          <Table2 aria-hidden="true" size={18} />
          Result Table
        </div>
        <div className="data-table-scroll">
          <table>
            <thead>
              <tr>
                {resultColumns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultTable.length === 0 ? (
                <tr>
                  <td>No result table yet.</td>
                </tr>
              ) : (
                resultTable.map((row, index) => (
                  <tr key={index}>
                    {resultColumns.map((column) => (
                      <td key={column}>{String(row[column] ?? "")}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="chart-canvas-panel" role="region" aria-label="Chart Canvas">
        <div className="panel-title">
          <BarChart3 aria-hidden="true" size={18} />
          Chart Canvas
        </div>
        {chart ? (
          <div className="analysis-chart">
            <strong>{chart.title}</strong>
            <span>{chart.metric}</span>
            {chart.data.map((datum) => (
              <div key={datum.label} className="analysis-bar-row">
                <code>{datum.label}</code>
                <div>
                  <span style={{ width: `${Math.max(8, (datum.value / chartMax) * 100)}%`, background: datum.color }} />
                </div>
                <strong>{datum.value.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No chart generated yet.</p>
        )}
      </div>

      <div className="sandbox-log-panel" role="region" aria-label="Sandbox Logs">
        <div className="panel-title">
          <SquareTerminal aria-hidden="true" size={18} />
          Sandbox Logs
        </div>
        <div className="sandbox-log-list">
          {sandboxLogs.length === 0 ? (
            <p className="muted">No sandbox logs yet.</p>
          ) : (
            sandboxLogs.map((log, index) => <code key={`${log}-${index}`}>{log}</code>)
          )}
        </div>
        {executionErrors.length > 0 ? (
          <div className="execution-error-list">
            {executionErrors.map((entry, index) => (
              <p key={`${entry}-${index}`}>{entry}</p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="retry-control-panel" role="region" aria-label="Retry Controls">
        <div className="panel-title">Retry Controls</div>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={retryAnalysis} disabled={!canRetry}>
            <RefreshCcw size={16} />
            Retry analysis
          </button>
        </div>
        <p className="final-line">{final || "Retry reuses the same thread and preserves the parsed dataset."}</p>
      </div>

      <div className="analysis-steps-panel" role="region" aria-label="Analysis Steps">
        <div className="panel-title">Analysis Steps</div>
        <div className="analysis-step-list">
          {analysisSteps.length === 0 ? (
            <p className="muted">No analysis steps yet.</p>
          ) : (
            analysisSteps.map((step) => (
              <article key={step.id} className={`analysis-step-row ${step.status}`}>
                <strong>{step.label}</strong>
                <span>{step.status}</span>
                <p>{step.detail}</p>
                <code>{step.id}</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="insights-panel" role="region" aria-label="Insights">
        <div className="panel-title">
          <Lightbulb aria-hidden="true" size={18} />
          Insights
        </div>
        <p>{insightSummary || "No insights yet."}</p>
      </div>

      <div className="analysis-events-panel" role="region" aria-label="Analysis Events">
        <div className="panel-title">Analysis Events</div>
        <div className="analysis-event-list">
          {analysisEvents.length === 0 ? (
            <p className="muted">No analysis events yet.</p>
          ) : (
            analysisEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className="analysis-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{percent(event.progress)}%</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel data-canvas-final-state" role="region" aria-label="Final State">
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
