import { isPlainObject, isArray, isString } from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import {
  JsonRecord,
  WorkerCard,
  mergeWorkers,
  samples,
  updateWorkerEvent,
  workersFromArray,
} from "./data";

// Local state is separate from SDK requests and rendering.
export function useParallelMapReduceState() {
  const [topic, setTopic] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [workers, setWorkers] = useState<WorkerCard[]>([]);
  const [reducerInputs, setReducerInputs] = useState<WorkerCard[]>([]);
  const [reducerOutput, setReducerOutput] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setWorkers([]);
    setReducerInputs([]);
    setReducerOutput("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (isArray(values.worker_statuses)) {
      setWorkers((current) =>
        mergeWorkers(current, workersFromArray(values.worker_statuses)),
      );
    }
    if (isArray(values.worker_results)) {
      const resultWorkers = workersFromArray(values.worker_results).map(
        (worker) => ({
          ...worker,
          status: worker.status === "pending" ? "done" : worker.status,
          detail: worker.detail || "Partial result ready for reducer.",
        }),
      );
      setWorkers((current) => mergeWorkers(current, resultWorkers));
    }
    if (isArray(values.reducer_inputs)) {
      setReducerInputs(workersFromArray(values.reducer_inputs));
    }
    if (isString(values.reducer_output)) {
      setReducerOutput(values.reducer_output);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!isPlainObject(data) || !isString(data.worker_id)) return;
    setWorkers((current) => updateWorkerEvent(current, data));
  }

  function prepareRunMapReduce() {
    setBusy(true);
    setError("");
    setEvents([]);
    setWorkers([]);
    setReducerInputs([]);
    setReducerOutput("");
    setFinalState(null);
    setStatus("Creating map-reduce thread");
  }

  return {
    prepareRunMapReduce,
    topic,
    setTopic,
    threadId,
    setThreadId,
    status,
    setStatus,
    workers,
    setWorkers,
    reducerInputs,
    setReducerInputs,
    reducerOutput,
    setReducerOutput,
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
    applyCustomEvent,
  };
}
