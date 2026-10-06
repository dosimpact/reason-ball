import { Loader2, Play, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import {
  assistantIdOf,
  assistantLabelOf,
  langGraphApiUrl,
} from "../../lib/langgraphClient";
import { ResultsPanel, StreamEventsPanel } from "./ResultsPanels";
import { useSdkConnection } from "./useSdkConnection";

export function SdkConnectionExample() {
  // 핵심 노트
  // - load assistant
  // -
  const {
    assistants,
    selectedAssistantId,
    setSelectedAssistantId,
    threadId,
    prompt,
    setPrompt,
    runId,
    status,
    answer,
    events,
    error,
    busy,
    loadAssistants,
    createThread,
    deleteThread,
    runAssistant,
  } = useSdkConnection();
  return (
    <section className="example-grid">
      <div className="control-panel">
        <div className="panel-title">
          <Server aria-hidden="true" size={18} />
          Runtime
        </div>

        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>

        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={loadAssistants}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            Load assistants
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={createThread}
            disabled={busy}
          >
            <Plus size={16} />
            New thread
          </button>
          <button
            type="button"
            className="icon-button danger"
            onClick={deleteThread}
            disabled={busy || !threadId}
          >
            <Trash2 size={16} />
          </button>
        </div>

        <label className="field">
          <span>Assistant</span>
          <select
            value={selectedAssistantId}
            onChange={(event) => setSelectedAssistantId(event.target.value)}
          >
            <option value="01_sdk_connection">sdk_connection</option>
            {assistants.map((assistant) => {
              const id = assistantIdOf(assistant);
              return (
                <option key={id} value={id}>
                  {assistantLabelOf(assistant)}
                </option>
              );
            })}
          </select>
        </label>

        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "none"}</strong>
          </div>
          <div>
            <span>Run</span>
            <strong>{runId || "pending"}</strong>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runAssistant();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Input</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
            />
          </label>
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !selectedAssistantId}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run and stream
          </button>
        </form>

        {error ? <p className="error-line">{error}</p> : null}
      </div>

      <ResultsPanel answer={answer} />

      <StreamEventsPanel runId={runId} events={events} />
    </section>
  );
}
