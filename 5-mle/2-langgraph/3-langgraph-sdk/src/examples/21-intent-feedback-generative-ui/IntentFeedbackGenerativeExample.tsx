import { CheckCircle2, Loader2, Play, RotateCcw, Send, SlidersHorizontal } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();

const ambiguousRequest = "Show me Apple stock.";
const completeRequest = "Show me AAPL on NASDAQ for 1M.";

type JsonRecord = Record<string, unknown>;
type FieldName = "ticker" | "market" | "period";

type Option = {
  label: string;
  value: string;
  description: string;
};

type UIRequest = {
  id: string;
  type: string;
  field: FieldName;
  title: string;
  description: string;
  required: boolean;
  options: Option[];
};

type IntentRecord = {
  userQuery: string;
  ticker: string;
  market: string;
  period: string;
  confidence: number;
  source: string;
};

type QuoteSnapshot = {
  ticker: string;
  company: string;
  market: string;
  period: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  asOf: string;
  source: string;
};

type IntentEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  field: string;
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

function normalizeOption(value: unknown): Option {
  const record = isRecord(value) ? value : {};
  return {
    label: typeof record.label === "string" ? record.label : String(record.value ?? ""),
    value: typeof record.value === "string" ? record.value : String(record.label ?? ""),
    description: typeof record.description === "string" ? record.description : "",
  };
}

function normalizeUiRequests(value: unknown): UIRequest[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((request) => {
    const field = request.field;
    if (field !== "ticker" && field !== "market" && field !== "period") return [];
    return [
      {
        id: typeof request.id === "string" ? request.id : `${field}-selector`,
        type: typeof request.type === "string" ? request.type : `${field}_selector`,
        field,
        title: typeof request.title === "string" ? request.title : `Choose ${field}`,
        description: typeof request.description === "string" ? request.description : "",
        required: typeof request.required === "boolean" ? request.required : true,
        options: Array.isArray(request.options) ? request.options.map(normalizeOption) : [],
      },
    ];
  });
}

function normalizeIntent(value: unknown): IntentRecord | null {
  if (!isRecord(value)) return null;
  return {
    userQuery: typeof value.user_query === "string" ? value.user_query : "",
    ticker: typeof value.ticker === "string" ? value.ticker : "",
    market: typeof value.market === "string" ? value.market : "",
    period: typeof value.period === "string" ? value.period : "",
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
    source: typeof value.source === "string" ? value.source : "",
  };
}

function normalizeQuote(value: unknown): QuoteSnapshot | null {
  if (!isRecord(value)) return null;
  return {
    ticker: typeof value.ticker === "string" ? value.ticker : "",
    company: typeof value.company === "string" ? value.company : "",
    market: typeof value.market === "string" ? value.market : "",
    period: typeof value.period === "string" ? value.period : "",
    currency: typeof value.currency === "string" ? value.currency : "",
    price: typeof value.price === "number" ? value.price : 0,
    change: typeof value.change === "number" ? value.change : 0,
    changePercent: typeof value.change_percent === "number" ? value.change_percent : 0,
    asOf: typeof value.as_of === "string" ? value.as_of : "",
    source: typeof value.source === "string" ? value.source : "",
  };
}

function normalizeEvents(value: unknown): IntentEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "intent_feedback",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    field: typeof event.field === "string" ? event.field : "",
  }));
}

function mergeIntentEvents(current: IntentEvent[], next: IntentEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next]
    .filter((event) => {
      const key = `${event.phase}:${event.status}:${event.detail}:${event.field}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-80);
}

function missingFields(value: unknown): FieldName[] {
  if (!Array.isArray(value)) return [];
  return value.filter((field): field is FieldName => field === "ticker" || field === "market" || field === "period");
}

export function IntentFeedbackGenerativeExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
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
  const [quoteSnapshot, setQuoteSnapshot] = useState<QuoteSnapshot | null>(null);
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [intentEvents, setIntentEvents] = useState<IntentEvent[]>([]);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
  const selectionComplete = Boolean(selection.ticker && selection.market && selection.period);

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
    if (isRecord(values.intent)) setIntent(normalizeIntent(values.intent));
    if (Array.isArray(values.missing_fields)) setMissing(missingFields(values.missing_fields));
    if (Array.isArray(values.ui_requests)) setUiRequests(normalizeUiRequests(values.ui_requests));
    if (isRecord(values.quote_snapshot)) setQuoteSnapshot(normalizeQuote(values.quote_snapshot));
    if (typeof values.answer === "string") setAnswer(values.answer);
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Array.isArray(values.intent_events)) {
      setIntentEvents((current) => mergeIntentEvents(current, normalizeEvents(values.intent_events)));
    }
    if (isRecord(values.selection)) {
      const incomingSelection = values.selection;
      setSelection((current) => ({
        ticker: typeof incomingSelection.ticker === "string" ? incomingSelection.ticker : current.ticker,
        market: typeof incomingSelection.market === "string" ? incomingSelection.market : current.market,
        period: typeof incomingSelection.period === "string" ? incomingSelection.period : current.period,
      }));
    }
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "intent_feedback") return;
    const event = normalizeEvents([data])[0];
    setIntentEvents((current) => mergeIntentEvents(current, [event]));
  }

  async function runIntent(input: JsonRecord, label: string) {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(`Preparing ${label}`);

    try {
      const thread = await client.threads.create({
        metadata: { example: "21-intent-feedback-generative-ui", label },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus(`Streaming ${label}`);
      const stream = await client.runs.stream(nextThreadId, "intent_feedback_generative_ui", {
        input,
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 140));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function runIntentCheck(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const query = userQuery.trim();
    if (!query) return;
    setFinalStatus("running");
    setIntent(null);
    setMissing([]);
    setUiRequests([]);
    setQuoteSnapshot(null);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setSelection({ ticker: "", market: "", period: "" });
    await runIntent({ user_query: query }, "intent check");
  }

  async function continueWithSelections() {
    if (!selectionComplete) return;
    await runIntent(
      {
        user_query: userQuery,
        selection,
      },
      "selection continuation",
    );
  }

  function selectOption(field: FieldName, value: string) {
    setSelection((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="intent-feedback-layout">
      <aside className="intent-control">
        <div className="panel-title">
          <SlidersHorizontal aria-hidden="true" size={18} />
          Intent Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => setUserQuery(ambiguousRequest)} disabled={busy}>
            Use ambiguous request
          </button>
          <button type="button" className="secondary-button" onClick={() => setUserQuery(completeRequest)} disabled={busy}>
            Use complete request
          </button>
        </div>
        <form className="run-form" onSubmit={runIntentCheck}>
          <label className="field">
            <span>Investor request</span>
            <textarea value={userQuery} onChange={(event) => setUserQuery(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !userQuery.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run intent check
            </button>
            <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>
        <button
          type="button"
          className="primary-button full-width-button"
          onClick={continueWithSelections}
          disabled={busy || !selectionComplete}
        >
          <Send size={16} />
          Continue with selections
        </button>
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
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`intent-status-panel ${finalStatus}`} role="region" aria-label="Intent Status">
        <div className="panel-title">Intent Status</div>
        <div className="intent-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Missing Fields</span>
            <strong>{missing.length ? missing.join(", ") : "none"}</strong>
          </div>
          <div>
            <span>UI Requests</span>
            <strong>{uiRequests.length}</strong>
          </div>
        </div>
      </div>

      <div className="generated-ui-panel" role="region" aria-label="Generated UI Request">
        <div className="panel-title">Generated UI Request</div>
        {uiRequests.length === 0 ? (
          <p className="muted">No generated controls are needed for a complete intent.</p>
        ) : (
          <div className="generated-ui-list">
            {uiRequests.map((request) => (
              <article key={request.id} className="generated-ui-card">
                <div>
                  <strong>{request.title}</strong>
                  <span>{request.type}</span>
                </div>
                <p>{request.description}</p>
                <div className="option-grid" role="radiogroup" aria-label={request.field}>
                  {request.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selection[request.field] === option.value}
                      className={selection[request.field] === option.value ? "option-chip active" : "option-chip"}
                      onClick={() => selectOption(request.field, option.value)}
                      disabled={busy}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="completed-intent-panel" role="region" aria-label="Completed Intent">
        <div className="panel-title">
          <CheckCircle2 aria-hidden="true" size={18} />
          Completed Intent
        </div>
        <div className="intent-detail-grid">
          <div>
            <span>Ticker</span>
            <strong>{intent?.ticker || selection.ticker || "missing"}</strong>
          </div>
          <div>
            <span>Market</span>
            <strong>{intent?.market || selection.market || "missing"}</strong>
          </div>
          <div>
            <span>Period</span>
            <strong>{intent?.period || selection.period || "missing"}</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>{intent?.source || "none"}</strong>
          </div>
        </div>
      </div>

      <div className="quote-snapshot-panel" role="region" aria-label="Quote Snapshot">
        <div className="panel-title">Quote Snapshot</div>
        {quoteSnapshot ? (
          <div className="quote-card">
            <strong>{quoteSnapshot.ticker} / {quoteSnapshot.market}</strong>
            <span>{quoteSnapshot.company}</span>
            <p>
              {quoteSnapshot.currency} {quoteSnapshot.price.toFixed(2)} ({quoteSnapshot.change >= 0 ? "+" : ""}
              {quoteSnapshot.change.toFixed(2)}, {quoteSnapshot.changePercent.toFixed(2)}%)
            </p>
            <small>{quoteSnapshot.period} · {quoteSnapshot.asOf} · {quoteSnapshot.source}</small>
          </div>
        ) : (
          <p className="muted">Quote snapshot appears after the intent is complete.</p>
        )}
      </div>

      <div className="intent-events-panel" role="region" aria-label="Intent Events">
        <div className="panel-title">Intent Events</div>
        <div className="intent-event-list">
          {intentEvents.length === 0 ? (
            <p className="muted">Intent and UI events will appear here.</p>
          ) : (
            intentEvents.map((event, index) => (
              <article key={`${event.phase}-${index}`} className={`intent-event ${event.status}`}>
                <strong>{event.phase}</strong>
                <code>{event.status}</code>
                <p>{event.detail}</p>
                {event.field ? <small>{event.field}</small> : null}
              </article>
            ))
          )}
        </div>
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box compact-answer">{final || answer || "No final answer yet."}</div>
      </div>

      <div className="state-panel intent-final-state" role="region" aria-label="Final State">
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
