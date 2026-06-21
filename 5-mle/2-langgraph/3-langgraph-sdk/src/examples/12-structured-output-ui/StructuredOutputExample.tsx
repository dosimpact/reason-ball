import {
  CheckCircle2,
  ClipboardList,
  FileJson,
  Loader2,
  Play,
  RotateCcw,
  Table2,
} from "lucide-react";
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
    label: "Launch Brief",
    value:
      "Extract a launch-readiness brief from this note: The LangGraph SDK learning workspace should ship a structured-output demo by Friday. Product owns the release checklist, engineering must verify schema validation, support needs a short troubleshooting note, and the main risk is confusing raw JSON with validated fields.",
  },
  {
    label: "Security Review",
    value:
      "Prepare a structured brief for a security review next Tuesday. Security owns the threat model, engineering owns dependency checks, support owns customer messaging, and the main risk is shipping without an escalation path.",
  },
  {
    label: "Support Launch",
    value:
      "Turn this support launch note into a structured object: Support should publish a help article by June 30, operations should prepare the handoff checklist, product should confirm scope, and the risk is unclear ownership for urgent issues.",
  },
];

type JsonRecord = Record<string, unknown>;

type FieldRow = {
  path: string;
  label: string;
  value: string;
  valueType: string;
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

function textValue(record: JsonRecord | null, key: string) {
  const value = record?.[key];
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeFieldRows(value: unknown): FieldRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((row, index) => ({
    path: typeof row.path === "string" ? row.path : `field_${index + 1}`,
    label: typeof row.label === "string" ? row.label : `Field ${index + 1}`,
    value: typeof row.value === "string" ? row.value : String(row.value ?? ""),
    valueType: typeof row.value_type === "string" ? row.value_type : String(row.valueType ?? "value"),
  }));
}

function schemaFields(schema: JsonRecord | null) {
  const properties = isRecord(schema?.properties) ? schema.properties : {};
  const requiredFields = Array.isArray(schema?.required) ? schema.required.map((field) => String(field)) : [];
  return Object.entries(properties).map(([name, value]) => ({
    name,
    type: isRecord(value) && typeof value.type === "string" ? value.type : "object",
    required: requiredFields.includes(name),
  }));
}

function actionItems(parsed: JsonRecord | null) {
  const actions = parsed?.actions;
  return Array.isArray(actions) ? actions.filter(isRecord) : [];
}

export function StructuredOutputExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
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

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
  const fields = useMemo(() => schemaFields(schemaJson), [schemaJson]);
  const actions = useMemo(() => actionItems(parsedObject), [parsedObject]);

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
    if (typeof values.schema_name === "string") {
      setSchemaName(values.schema_name);
    }
    if (isRecord(values.schema_json)) {
      setSchemaJson(values.schema_json);
    }
    if (isRecord(values.parsed_object)) {
      setParsedObject(values.parsed_object);
    }
    if (typeof values.validation_status === "string") {
      setValidationStatus(values.validation_status);
    }
    if (Array.isArray(values.validation_errors)) {
      setValidationErrors(normalizeStringList(values.validation_errors));
    }
    if (Array.isArray(values.field_rows)) {
      setFieldRows(normalizeFieldRows(values.field_rows));
    }
    if (typeof values.raw_model_output === "string") {
      setRawModelOutput(values.raw_model_output);
    }
    if (typeof values.final === "string") {
      setFinal(values.final);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  async function runExtraction(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = request.trim();
    if (!trimmed) return;

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

    try {
      const thread = await client.threads.create({
        metadata: { example: "12-structured-output-ui", schema: "LaunchBrief" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming structured extraction");

      const stream = await client.runs.stream(nextThreadId, "structured_output", {
        input: { request: trimmed },
        streamMode: "updates",
      });

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

  return (
    <section className="structured-layout">
      <aside className="structured-control">
        <div className="panel-title">
          <ClipboardList aria-hidden="true" size={18} />
          Structured Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="sample-list" aria-label="Structured output samples">
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
        <form onSubmit={runExtraction} className="run-form">
          <label className="field">
            <span>Request</span>
            <textarea value={request} onChange={(event) => setRequest(event.target.value)} rows={7} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !request.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run structured extraction
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
            <span>Fields</span>
            <strong>{fieldRows.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div
        className={`validation-panel ${validationStatus}`}
        role="region"
        aria-label="Validation Status"
      >
        <div className="panel-title">
          <CheckCircle2 aria-hidden="true" size={18} />
          Validation Status
        </div>
        <div className="validation-badge">{validationStatus}</div>
        {validationErrors.length === 0 ? (
          <p className="muted">No validation errors. Run the graph to confirm the parsed object.</p>
        ) : (
          <ul className="validation-error-list">
            {validationErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {final ? <p className="final-line">{final}</p> : null}
      </div>

      <div className="schema-panel" role="region" aria-label="Schema">
        <div className="panel-title">
          <FileJson aria-hidden="true" size={18} />
          Schema
        </div>
        <div className="schema-card">
          <span>Schema Name</span>
          <code>{schemaName}</code>
        </div>
        <div className="schema-field-list">
          {fields.length === 0 ? (
            <p className="muted">Schema fields will appear after the first update.</p>
          ) : (
            fields.map((field) => (
              <div key={field.name} className="schema-field">
                <strong>{field.name}</strong>
                <span>{field.required ? "required" : "optional"}</span>
                <code>{field.type}</code>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="structured-result-panel" role="region" aria-label="Structured Result">
        <div className="panel-title">Structured Result</div>
        {parsedObject ? (
          <div className="structured-summary">
            <div>
              <span>Title</span>
              <strong>{textValue(parsedObject, "title")}</strong>
            </div>
            <div>
              <span>Priority</span>
              <strong>{textValue(parsedObject, "priority")}</strong>
            </div>
            <div>
              <span>Team</span>
              <strong>{textValue(parsedObject, "team")}</strong>
            </div>
            <div>
              <span>Deadline</span>
              <strong>{textValue(parsedObject, "deadline")}</strong>
            </div>
            <div className="wide">
              <span>Summary</span>
              <p>{textValue(parsedObject, "summary")}</p>
            </div>
            <div className="wide">
              <span>Actions</span>
              <ol className="action-list">
                {actions.map((action, index) => (
                  <li key={`${String(action.owner)}-${index}`}>
                    <strong>{String(action.owner ?? "Owner")}</strong>
                    <p>{String(action.task ?? "")}</p>
                    <code>{String(action.due ?? "")}</code>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <p className="muted">Run a request to see the parsed LaunchBrief object.</p>
        )}
      </div>

      <div className="field-table-panel" role="region" aria-label="Field Table">
        <div className="panel-title">
          <Table2 aria-hidden="true" size={18} />
          Field Table
        </div>
        {fieldRows.length === 0 ? (
          <p className="muted">Validated fields will appear here.</p>
        ) : (
          <table className="field-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Path</th>
                <th>Type</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {fieldRows.map((row) => (
                <tr key={row.path}>
                  <td>{row.label}</td>
                  <td>
                    <code>{row.path}</code>
                  </td>
                  <td>{row.valueType}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="raw-json-panel" role="region" aria-label="Raw JSON">
        <div className="panel-title">Raw JSON</div>
        <pre>{rawModelOutput || (parsedObject ? formatJson(parsedObject) : "No raw JSON yet.")}</pre>
      </div>

      <div className="state-panel structured-final-state" role="region" aria-label="Final State">
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
