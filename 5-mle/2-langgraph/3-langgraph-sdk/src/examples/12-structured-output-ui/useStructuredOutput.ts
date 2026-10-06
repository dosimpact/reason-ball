import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { actionItems, nodePayloads, schemaFields, valuesOf } from "./data";
import { useStructuredOutputState } from "./useStructuredOutputState";

export function useStructuredOutput() {
  const {
    prepareRunExtraction,
    request,
    setRequest,
    threadId,
    setThreadId,
    status,
    setStatus,
    schemaName,
    setSchemaName,
    schemaJson,
    setSchemaJson,
    parsedObject,
    setParsedObject,
    validationStatus,
    setValidationStatus,
    validationErrors,
    setValidationErrors,
    fieldRows,
    setFieldRows,
    rawModelOutput,
    setRawModelOutput,
    final,
    setFinal,
    finalState,
    setFinalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
    applyValues,
  } = useStructuredOutputState();

  const client = useMemo(() => createLangGraphClient(), []);

  const fields = useMemo(() => schemaFields(schemaJson), [schemaJson]);

  const actions = useMemo(() => actionItems(parsedObject), [parsedObject]);

  async function runExtraction() {
    const trimmed = request.trim();
    if (!trimmed) return;

    prepareRunExtraction();

    try {
      const thread = await client.threads.create({
        metadata: { example: "12-structured-output-ui", schema: "LaunchBrief" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming structured extraction");

      const stream = await client.runs.stream(
        nextThreadId,
        "12_structured_output",
        {
          input: { request: trimmed },
          streamMode: "updates",
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 100));
        for (const payload of nodePayloads(logEntry.data)) {
          applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      applyValues(values);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }
  return {
    request,
    setRequest,
    threadId,
    status,
    schemaName,
    parsedObject,
    validationStatus,
    validationErrors,
    fieldRows,
    rawModelOutput,
    final,
    finalState,
    events,
    error,
    busy,
    fields,
    actions,
    resetView,
    runExtraction,
  };
}
