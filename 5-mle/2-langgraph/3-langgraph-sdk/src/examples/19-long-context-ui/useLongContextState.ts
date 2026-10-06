import * as R from "remeda";
import { useState } from "react";
import {
  ChatMessageRecord,
  StreamLogEntry,
  normalizeMessages,
} from "../../lib/langgraphClient";
import { type JsonRecord, type MessageDigest, type SummaryMetadata, type SummaryRecord, type ContextStats, type ContextEvent, normalizeDigests, normalizeMetadata, normalizeSummaryRecords, normalizeContextStats, normalizeContextEvents, mergeEvents } from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useLongContextState() {
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [summary, setSummary] = useState("");
  const [summaryMetadata, setSummaryMetadata] =
    useState<SummaryMetadata | null>(null);
  const [summaryRecords, setSummaryRecords] = useState<SummaryRecord[]>([]);
  const [summarizedMessages, setSummarizedMessages] = useState<MessageDigest[]>(
    [],
  );
  const [contextEvents, setContextEvents] = useState<ContextEvent[]>([]);
  const [contextStats, setContextStats] = useState<ContextStats>(
    normalizeContextStats(null),
  );
  const [assistantResponse, setAssistantResponse] = useState("");
  const [final, setFinal] = useState("");
  const [lastCompactionRunId, setLastCompactionRunId] = useState("");
  const [followUp, setFollowUp] = useState(
    "Using the summarized earlier context, what project codename and pet name did I mention?",
  );
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function resetState() {
    setThreadId("");
    setStatus("Idle");
    setMessages([]);
    setSummary("");
    setSummaryMetadata(null);
    setSummaryRecords([]);
    setSummarizedMessages([]);
    setContextEvents([]);
    setContextStats(normalizeContextStats(null));
    setAssistantResponse("");
    setFinal("");
    setLastCompactionRunId("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (R.isArray(values.messages)) setMessages(normalizeMessages(values));
    if (R.isString(values.summary)) setSummary(values.summary);
    if (R.isPlainObject(values.summary_metadata))
      setSummaryMetadata(normalizeMetadata(values.summary_metadata));
    if (R.isArray(values.summary_records))
      setSummaryRecords(normalizeSummaryRecords(values.summary_records));
    if (R.isArray(values.summarized_messages))
      setSummarizedMessages(normalizeDigests(values.summarized_messages));
    if (R.isArray(values.context_events)) {
      setContextEvents((current) =>
        mergeEvents(current, normalizeContextEvents(values.context_events)),
      );
    }
    if (R.isPlainObject(values.context_stats))
      setContextStats(normalizeContextStats(values.context_stats));
    if (R.isString(values.assistant_response))
      setAssistantResponse(values.assistant_response);
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.last_compaction_run_id))
      setLastCompactionRunId(values.last_compaction_run_id);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "context_status") return;
    const event = normalizeContextEvents([data])[0];
    setContextEvents((current) => mergeEvents(current, [event]));
  }

  const latestRecord = summaryRecords.at(-1) ?? null;

  function prepareReloadState() {
    setBusy(true);
    setError("");
    setStatus("Loading context state");
  }

  function prepareRunMessages(label: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(`Preparing ${label}`);
  }

  function prepareCreateThread() {
    setBusy(true);
    setError("");
    setStatus("Creating context thread");
  }

  return {
    threadId,
    setThreadId,
    status,
    setStatus,
    messages,
    summary,
    summaryMetadata,
    summaryRecords,
    summarizedMessages,
    contextEvents,
    contextStats,
    assistantResponse,
    final,
    lastCompactionRunId,
    followUp,
    setFollowUp,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetState,
    applyValues,
    applyCustomEvent,
    latestRecord,
    prepareReloadState,
    prepareRunMessages,
    prepareCreateThread,
  };
}
