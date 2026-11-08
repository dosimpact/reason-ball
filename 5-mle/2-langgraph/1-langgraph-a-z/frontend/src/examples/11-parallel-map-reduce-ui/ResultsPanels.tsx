import { GitMerge } from "lucide-react";

import { formatJson } from "./data";
import type { useParallelMapReduce } from "./useParallelMapReduce";

export function ResultsPanel({
  reducerOutput,
}: Pick<ReturnType<typeof useParallelMapReduce>, "reducerOutput">) {
  return (
    <div
      className="result-panel reducer-output-panel"
      role="region"
      aria-label="Reducer Output"
    >
      <div className="panel-title">Reducer Output</div>
      <div className="answer-box">
        {reducerOutput
          ? `Final combined output: ${reducerOutput}`
          : "No reducer output yet."}
      </div>
    </div>
  );
}

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useParallelMapReduce>, "events">) {
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
                <strong>{entry.event}</strong>
              </summary>
              <pre>{formatJson(entry.data)}</pre>
            </details>
          ))
        )}
      </div>
    </div>
  );
}

export function WorkerProgressView({
  status,
  workers,
}: Pick<ReturnType<typeof useParallelMapReduce>, "status" | "workers">) {
  return (
    <div
      className="worker-progress-panel"
      role="region"
      aria-label="Worker Progress"
    >
      <div className="panel-title">Worker Progress</div>
      <div className="worker-card-grid">
        {workers.length === 0 ? (
          <p className="muted">Run a topic to see parallel worker progress.</p>
        ) : (
          workers.map((worker) => (
            <article
              key={worker.id}
              className={`worker-card ${worker.status}`}
              data-worker-id={worker.id}
            >
              <div className="worker-card-header">
                <strong>{worker.label}</strong>
                <span>
                  {worker.status === "done" ? "completed" : worker.status}
                </span>
              </div>
              <code>worker_id: {worker.id}</code>
              <p className="worker-item">
                Item {worker.index + 1}: {worker.item}
              </p>
              <p>
                <strong>
                  {worker.result ? "Partial result:" : "Progress:"}
                </strong>{" "}
                {worker.result ||
                  worker.detail ||
                  "Waiting for partial result."}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export function ReducerInputsView({
  status,
  reducerInputs,
}: Pick<ReturnType<typeof useParallelMapReduce>, "status" | "reducerInputs">) {
  return (
    <div
      className="reducer-input-panel"
      role="region"
      aria-label="Reducer Inputs"
    >
      <div className="panel-title">
        <GitMerge aria-hidden="true" size={18} />
        Reducer Inputs
      </div>
      {reducerInputs.length === 0 ? (
        <p className="muted">No reducer inputs yet.</p>
      ) : (
        <ol className="reducer-input-list">
          {reducerInputs.map((input) => (
            <li
              key={input.id}
              className="reducer-input"
              data-worker-id={input.id}
            >
              <strong>{input.label}</strong>
              <span>{input.status}</span>
              <p>{input.result}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function FinalStateView({
  finalState,
}: Pick<ReturnType<typeof useParallelMapReduce>, "finalState">) {
  return (
    <div
      className="state-panel parallel-final-state"
      role="region"
      aria-label="Final State"
    >
      <div className="panel-title">Final State</div>
      <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
    </div>
  );
}
