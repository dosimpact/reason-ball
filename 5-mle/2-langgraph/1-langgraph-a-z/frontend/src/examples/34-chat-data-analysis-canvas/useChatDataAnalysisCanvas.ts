import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { type JsonRecord, nodePayloads, valuesOf } from "./model";

import { useChatDataAnalysisCanvasState } from "./useChatDataAnalysisCanvasState";

// SDK requests, browser input preparation, and stream consumption.
export function useChatDataAnalysisCanvas() {
  const state = useChatDataAnalysisCanvasState();
  const {
    userRequest,
    csvText,
    setCsvText,
    threadId,
    setThreadId,
    setStatus,
    setFinalStatus,
    datasetName,
    setDatasetName,
    setEvents,
    setError,
    setUploadStatus,
    setBusy,
    resetView,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function streamRun(input: JsonRecord, reuseThreadId = "") {
    startRun(reuseThreadId);

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
      failRun(caught);
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
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

  async function handleCsvUpload(file: File | undefined) {
    if (!file) {
      setUploadStatus("No CSV file selected.");
      return;
    }

    try {
      const text = await file.text();
      setDatasetName(file.name);
      setCsvText(text);
      setUploadStatus(`Loaded ${file.name} (${text.split(/\r?\n/).filter(Boolean).length} line(s)).`);
    } catch (caught) {
      setUploadStatus("Could not read the selected CSV file.");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return {
    userRequest,
    setUserRequest: state.setUserRequest,
    csvText,
    setCsvText,
    threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    datasetName,
    setDatasetName,
    rowCount: state.rowCount,
    columns: state.columns,
    previewRows: state.previewRows,
    generatedCode: state.generatedCode,
    analysisSteps: state.analysisSteps,
    executionStatus: state.executionStatus,
    retryCount: state.retryCount,
    sandboxLogs: state.sandboxLogs,
    executionErrors: state.executionErrors,
    resultTable: state.resultTable,
    insightSummary: state.insightSummary,
    analysisEvents: state.analysisEvents,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    uploadStatus: state.uploadStatus,
    busy: state.busy,
    canRetry: state.canRetry,
    resultColumns: state.resultColumns,
    previewColumns: state.previewColumns,
    chart: state.chart,
    chartMax: state.chartMax,
    resetView,
    retryAnalysis,
    runAnalysis,
    handleCsvUpload,
  };
}
