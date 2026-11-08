import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import { type AnalysisEvent, type AnalysisStep, type ChartSpec, type DatasetColumn, defaultCsv, defaultRequest, type JsonRecord, mergeEvents, normalizeChartSpecs, normalizeColumns, normalizeEvents, normalizeRows, normalizeSteps, normalizeStrings, rowsFromResultTable, tableColumns, type TableRow } from "./model";

// Local state, derived values, and synchronous state transitions.
export function useChatDataAnalysisCanvasState() {
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
  const [uploadStatus, setUploadStatus] = useState("No CSV file selected.");
  const [busy, setBusy] = useState(false);
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
    setUploadStatus("No CSV file selected.");
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.dataset_name)) setDatasetName(values.dataset_name);
    if (R.isPlainObject(values.dataset_metadata)) {
      const metadata = values.dataset_metadata;
      if (typeof metadata.row_count === "number") setRowCount(metadata.row_count);
      if (R.isString(metadata.source)) setDatasetName(`${metadata.source} dataset`);
    }
    if (typeof values.row_count === "number") setRowCount(values.row_count);
    if (R.isArray(values.columns)) setColumns(normalizeColumns(values.columns));
    if (R.isArray(values.parsed_columns)) setColumns(normalizeColumns(values.parsed_columns));
    if (R.isArray(values.preview_rows)) setPreviewRows(normalizeRows(values.preview_rows));
    if (R.isString(values.generated_code)) setGeneratedCode(values.generated_code);
    if (R.isArray(values.analysis_steps)) setAnalysisSteps(normalizeSteps(values.analysis_steps));
    if (R.isString(values.execution_status)) setExecutionStatus(values.execution_status);
    if (typeof values.retry_count === "number") setRetryCount(values.retry_count);
    if (R.isArray(values.sandbox_logs)) setSandboxLogs(normalizeStrings(values.sandbox_logs));
    if (R.isArray(values.execution_errors)) setExecutionErrors(normalizeStrings(values.execution_errors));
    if (R.isArray(values.chart_specs)) setChartSpecs(normalizeChartSpecs(values.chart_specs));
    if (values.result_table !== undefined) setResultTable(rowsFromResultTable(values.result_table));
    if (R.isString(values.insight_summary)) setInsightSummary(values.insight_summary);
    if (R.isArray(values.analysis_events)) {
      setAnalysisEvents((current) => mergeEvents(current, normalizeEvents(values.analysis_events)));
    }
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status)) setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) {
      setFinalState((current) => ({ ...(current ?? {}), ...values }));
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "34_chat_data_analysis_canvas") return;
    setAnalysisEvents((current) => mergeEvents(current, normalizeEvents([data])));
  }

  function startRun(reuseThreadId: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming analysis update" : "Creating data analysis thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setFinalStatus("failed");
    setStatus("Run failed");
  }

  return {
    userRequest,
    setUserRequest,
    csvText,
    setCsvText,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    setFinalStatus,
    datasetName,
    setDatasetName,
    rowCount,
    columns,
    previewRows,
    generatedCode,
    analysisSteps,
    executionStatus,
    retryCount,
    sandboxLogs,
    executionErrors,
    resultTable,
    insightSummary,
    analysisEvents,
    final,
    finalState,
    events,
    setEvents,
    error,
    setError,
    uploadStatus,
    setUploadStatus,
    busy,
    setBusy,
    canRetry,
    resultColumns,
    previewColumns,
    chart,
    chartMax,
    resetView,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  };
}
