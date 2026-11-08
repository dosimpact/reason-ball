import { CheckCircle2, FileJson, Table2 } from "lucide-react";

import { formatJson, textValue } from "./data";
import type { useStructuredOutput } from "./useStructuredOutput";

export function ResultsPanel({
  parsedObject,
  actions,
}: Pick<ReturnType<typeof useStructuredOutput>, "parsedObject" | "actions">) {
  return (
    <div
      className="structured-result-panel"
      role="region"
      aria-label="Structured Result"
    >
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
        <p className="muted">
          Run a request to see the parsed LaunchBrief object.
        </p>
      )}
    </div>
  );
}

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useStructuredOutput>, "events">) {
  return (
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
  );
}

export function ValidationStatusView({
  validationStatus,
  validationErrors,
  final,
}: Pick<
  ReturnType<typeof useStructuredOutput>,
  "validationStatus" | "validationErrors" | "final"
>) {
  return (
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
        <p className="muted">
          No validation errors. Run the graph to confirm the parsed object.
        </p>
      ) : (
        <ul className="validation-error-list">
          {validationErrors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {final ? <p className="final-line">{final}</p> : null}
    </div>
  );
}

export function SchemaView({
  schemaName,
  fields,
}: Pick<ReturnType<typeof useStructuredOutput>, "schemaName" | "fields">) {
  return (
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
          <p className="muted">
            Schema fields will appear after the first update.
          </p>
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
  );
}

export function FieldTableView({
  fieldRows,
}: Pick<ReturnType<typeof useStructuredOutput>, "fieldRows">) {
  return (
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
  );
}

export function RawJSONView({
  parsedObject,
  rawModelOutput,
}: Pick<
  ReturnType<typeof useStructuredOutput>,
  "parsedObject" | "rawModelOutput"
>) {
  return (
    <div className="raw-json-panel" role="region" aria-label="Raw JSON">
      <div className="panel-title">Raw JSON</div>
      <pre>
        {rawModelOutput ||
          (parsedObject ? formatJson(parsedObject) : "No raw JSON yet.")}
      </pre>
    </div>
  );
}

export function FinalStateView({
  finalState,
}: Pick<ReturnType<typeof useStructuredOutput>, "finalState">) {
  return (
    <div
      className="state-panel structured-final-state"
      role="region"
      aria-label="Final State"
    >
      <div className="panel-title">Final State</div>
      <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
    </div>
  );
}
