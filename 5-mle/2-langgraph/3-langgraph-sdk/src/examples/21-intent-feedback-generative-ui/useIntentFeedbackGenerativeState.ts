import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { ambiguousRequest, type JsonRecord, type FieldName, type UIRequest, type IntentRecord, type QuoteSnapshot, type IntentEvent, normalizeUiRequests, normalizeIntent, normalizeQuote, normalizeEvents, mergeIntentEvents, missingFields } from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useIntentFeedbackGenerativeState() {
  const [userQuery, setUserQuery] = useState(ambiguousRequest);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [intent, setIntent] = useState<IntentRecord | null>(null);
  const [missing, setMissing] = useState<FieldName[]>([]);
  const [uiRequests, setUiRequests] = useState<UIRequest[]>([]);
  const [selection, setSelection] = useState<Record<FieldName, string>>({
    ticker: "",
    market: "",
    period: "",
  });
  const [quoteSnapshot, setQuoteSnapshot] = useState<QuoteSnapshot | null>(
    null,
  );
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [intentEvents, setIntentEvents] = useState<IntentEvent[]>([]);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectionComplete = Boolean(
    selection.ticker && selection.market && selection.period,
  );

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setIntent(null);
    setMissing([]);
    setUiRequests([]);
    setSelection({ ticker: "", market: "", period: "" });
    setQuoteSnapshot(null);
    setAnswer("");
    setFinal("");
    setIntentEvents([]);
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (R.isPlainObject(values.intent)) setIntent(normalizeIntent(values.intent));
    if (R.isArray(values.missing_fields))
      setMissing(missingFields(values.missing_fields));
    if (R.isArray(values.ui_requests))
      setUiRequests(normalizeUiRequests(values.ui_requests));
    if (R.isPlainObject(values.quote_snapshot))
      setQuoteSnapshot(normalizeQuote(values.quote_snapshot));
    if (R.isString(values.answer)) setAnswer(values.answer);
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status))
      setFinalStatus(values.final_status);
    if (R.isArray(values.intent_events)) {
      setIntentEvents((current) =>
        mergeIntentEvents(current, normalizeEvents(values.intent_events)),
      );
    }
    if (R.isPlainObject(values.selection)) {
      const incomingSelection = values.selection;
      setSelection((current) => ({
        ticker:
          R.isString(incomingSelection.ticker)
            ? incomingSelection.ticker
            : current.ticker,
        market:
          R.isString(incomingSelection.market)
            ? incomingSelection.market
            : current.market,
        period:
          R.isString(incomingSelection.period)
            ? incomingSelection.period
            : current.period,
      }));
    }
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "intent_feedback") return;
    const event = normalizeEvents([data])[0];
    setIntentEvents((current) => mergeIntentEvents(current, [event]));
  }

  function selectOption(field: FieldName, value: string) {
    setSelection((current) => ({ ...current, [field]: value }));
  }

  function prepareRunIntent(label: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(`Preparing ${label}`);
  }

  function prepareRunIntentCheck() {
    setFinalStatus("running");
    setIntent(null);
    setMissing([]);
    setUiRequests([]);
    setQuoteSnapshot(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setSelection({ ticker: "", market: "", period: "" });
  }

  return {
    userQuery,
    setUserQuery,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    intent,
    missing,
    uiRequests,
    selection,
    quoteSnapshot,
    answer,
    final,
    intentEvents,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    selectionComplete,
    resetView,
    applyValues,
    applyCustomEvent,
    selectOption,
    prepareRunIntent,
    prepareRunIntentCheck,
  };
}
