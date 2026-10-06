import { isPlainObject, isArray, isString } from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import {
  FieldRow,
  JsonRecord,
  normalizeFieldRows,
  normalizeStringList,
  samples,
} from "./data";

// Local state is separate from SDK requests and rendering.
export function useStructuredOutputState() {
  const [request, setRequest] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [schemaName, setSchemaName] = useState("LaunchBrief");
  const [schemaJson, setSchemaJson] = useState<JsonRecord | null>(null);
  const [parsedObject, setParsedObject] = useState<JsonRecord | null>(null);
  const [validationStatus, setValidationStatus] = useState("pending");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldRows, setFieldRows] = useState<FieldRow[]>([]);
  const [rawModelOutput, setRawModelOutput] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setSchemaName("LaunchBrief");
    setSchemaJson(null);
    setParsedObject(null);
    setValidationStatus("pending");
    setValidationErrors([]);
    setFieldRows([]);
    setRawModelOutput("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (isString(values.schema_name)) {
      setSchemaName(values.schema_name);
    }
    if (isPlainObject(values.schema_json)) {
      setSchemaJson(values.schema_json);
    }
    if (isPlainObject(values.parsed_object)) {
      setParsedObject(values.parsed_object);
    }
    if (isString(values.validation_status)) {
      setValidationStatus(values.validation_status);
    }
    if (isArray(values.validation_errors)) {
      setValidationErrors(normalizeStringList(values.validation_errors));
    }
    if (isArray(values.field_rows)) {
      setFieldRows(normalizeFieldRows(values.field_rows));
    }
    if (isString(values.raw_model_output)) {
      setRawModelOutput(values.raw_model_output);
    }
    if (isString(values.final)) {
      setFinal(values.final);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function prepareRunExtraction() {
    setBusy(true);
    setError("");
    setEvents([]);
    setParsedObject(null);
    setValidationStatus("pending");
    setValidationErrors([]);
    setFieldRows([]);
    setRawModelOutput("");
    setFinal("");
    setFinalState(null);
    setStatus("Creating structured-output thread");
  }

  return {
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
  };
}
