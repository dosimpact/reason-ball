import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { warningPrompt, type JsonRecord, type RendererEvent, type PhaseRecord, knownKinds, normalizeRendererEvent, normalizeRendererEvents, normalizePhaseRecords, mergeUniqueByEventId, mergeInlineEvents, mergePhaseRecords } from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useCustomEventRendererState() {
  const [taskId, setTaskId] = useState("renderer-demo-001");
  const [taskPrompt, setTaskPrompt] = useState(warningPrompt);
  const [threadId, setThreadId] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [inlineEvents, setInlineEvents] = useState<RendererEvent[]>([]);
  const [renderEvents, setRenderEvents] = useState<RendererEvent[]>([]);
  const [phaseRecords, setPhaseRecords] = useState<PhaseRecord[]>([]);
  const [unknownEvents, setUnknownEvents] = useState<RendererEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rendererMetadata, setRendererMetadata] = useState<JsonRecord | null>(
    null,
  );
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const warningEvents = renderEvents.filter(
    (event) => event.kind === "warning",
  );

  const progressComplete = inlineEvents.some(
    (event) => event.progress >= 1 || event.status === "completed",
  );

  function resetView() {
    setThreadId("");
    setRunId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setInlineEvents([]);
    setRenderEvents([]);
    setPhaseRecords([]);
    setUnknownEvents([]);
    setWarnings([]);
    setRendererMetadata(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyRendererEvents(next: RendererEvent[]) {
    setRenderEvents((current) => mergeUniqueByEventId(current, next));
    setInlineEvents((current) => mergeInlineEvents(current, next));
    const unknown = next.filter((event) => !knownKinds.has(event.kind));
    if (unknown.length)
      setUnknownEvents((current) => mergeUniqueByEventId(current, unknown));
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.run_id)) setRunId(values.run_id);
    if (R.isString(values.final_status))
      setFinalStatus(values.final_status);
    if (R.isArray(values.render_events))
      applyRendererEvents(normalizeRendererEvents(values.render_events));
    if (R.isArray(values.progress_events))
      applyRendererEvents(normalizeRendererEvents(values.progress_events));
    if (R.isArray(values.unknown_events)) {
      setUnknownEvents((current) =>
        mergeUniqueByEventId(
          current,
          normalizeRendererEvents(values.unknown_events),
        ),
      );
    }
    if (R.isArray(values.phase_records)) {
      setPhaseRecords((current) =>
        mergePhaseRecords(current, normalizePhaseRecords(values.phase_records)),
      );
    }
    if (R.isArray(values.warnings))
      setWarnings(values.warnings.map(String));
    if (R.isPlainObject(values.renderer_metadata))
      setRendererMetadata(values.renderer_metadata);
    if (R.isString(values.answer)) setAnswer(values.answer);
    if (R.isString(values.final)) setFinal(values.final);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    const event = normalizeRendererEvent(data);
    if (!event) return;
    applyRendererEvents([event]);
  }

  function prepareRunRenderer() {
    setBusy(true);
    setError("");
    setEvents([]);
    setInlineEvents([]);
    setRenderEvents([]);
    setPhaseRecords([]);
    setUnknownEvents([]);
    setWarnings([]);
    setRendererMetadata(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setFinalStatus("running");
    setStatus("Creating renderer thread");
  }

  return {
    taskId,
    setTaskId,
    taskPrompt,
    setTaskPrompt,
    threadId,
    setThreadId,
    runId,
    status,
    setStatus,
    finalStatus,
    setFinalStatus,
    inlineEvents,
    phaseRecords,
    unknownEvents,
    warnings,
    rendererMetadata,
    answer,
    final,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    warningEvents,
    progressComplete,
    resetView,
    applyValues,
    applyCustomEvent,
    prepareRunRenderer,
  };
}
