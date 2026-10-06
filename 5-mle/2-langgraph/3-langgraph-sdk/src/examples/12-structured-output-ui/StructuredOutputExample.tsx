import { ClipboardList, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samples } from "./data";
import {
  FieldTableView,
  FinalStateView,
  RawJSONView,
  ResultsPanel,
  SchemaView,
  StreamEventsPanel,
  ValidationStatusView,
} from "./ResultsPanels";
import { useStructuredOutput } from "./useStructuredOutput";

export function StructuredOutputExample() {
  const {
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
  } = useStructuredOutput();
  return (
    <section className="structured-layout">
      <aside className="structured-control">
        <div className="panel-title">
          <ClipboardList aria-hidden="true" size={18} />
          Structured Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runExtraction();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Request</span>
            <textarea
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              rows={7}
            />
          </label>
          <div className="button-row">
            <button
              type="submit"
              className="primary-button"
              disabled={busy || !request.trim()}
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              Run structured extraction
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetView}
              disabled={busy}
            >
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

      <ValidationStatusView
        validationStatus={validationStatus}
        validationErrors={validationErrors}
        final={final}
      />

      <SchemaView schemaName={schemaName} fields={fields} />

      <ResultsPanel parsedObject={parsedObject} actions={actions} />

      <FieldTableView fieldRows={fieldRows} />

      <RawJSONView
        parsedObject={parsedObject}
        rawModelOutput={rawModelOutput}
      />

      <FinalStateView finalState={finalState} />

      <StreamEventsPanel events={events} />
    </section>
  );
}
