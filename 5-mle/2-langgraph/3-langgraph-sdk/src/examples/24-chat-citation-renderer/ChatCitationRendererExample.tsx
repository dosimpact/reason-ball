import { BookOpenText, ExternalLink, FileSearch, Link2, Loader2, Play, RotateCcw } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";


const evidenceQuestion =
  "How should a chat UI render inline citation chips, hover previews, and source document cards?";
const streamQuestion =
  "How can LangGraph SDK stream updates and custom events help debug citation renderer state?";

type JsonRecord = Record<string, unknown>;

type SourceDoc = {
  id: string;
  rank: number;
  title: string;
  url: string;
  sourceType: string;
  score: number;
  snippet: string;
  text: string;
  matchedTerms: string[];
};

type AnswerSegment = {
  id: string;
  text: string;
  citationIds: string[];
};

type Citation = {
  id: string;
  label: string;
  sourceId: string;
  segmentId: string;
  title: string;
  url: string;
  snippet: string;
  rank: number;
  score: number;
};

type CitationEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  sourceId: string;
  citationId: string;
  timestamp: string;
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

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

function normalizeSources(value: unknown): SourceDoc[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((source, index) => ({
    id: typeof source.id === "string" ? source.id : `doc-${index + 1}`,
    rank: numberValue(source.rank, index + 1),
    title: typeof source.title === "string" ? source.title : `Source ${index + 1}`,
    url: typeof source.url === "string" ? source.url : "",
    sourceType: typeof source.source_type === "string" ? source.source_type : "",
    score: numberValue(source.score),
    snippet: typeof source.snippet === "string" ? source.snippet : "",
    text: typeof source.text === "string" ? source.text : "",
    matchedTerms: Array.isArray(source.matched_terms) ? source.matched_terms.map(String) : [],
  }));
}

function normalizeSegments(value: unknown): AnswerSegment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((segment, index) => ({
    id: typeof segment.id === "string" ? segment.id : `seg-${index + 1}`,
    text: typeof segment.text === "string" ? segment.text : "",
    citationIds: Array.isArray(segment.citation_ids) ? segment.citation_ids.map(String) : [],
  }));
}

function normalizeCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((citation, index) => ({
    id: typeof citation.id === "string" ? citation.id : `cite-${index + 1}`,
    label: typeof citation.label === "string" ? citation.label : `[cite-${index + 1}]`,
    sourceId: typeof citation.source_id === "string" ? citation.source_id : "",
    segmentId: typeof citation.segment_id === "string" ? citation.segment_id : "",
    title: typeof citation.title === "string" ? citation.title : "",
    url: typeof citation.url === "string" ? citation.url : "",
    snippet: typeof citation.snippet === "string" ? citation.snippet : "",
    rank: numberValue(citation.rank, index + 1),
    score: numberValue(citation.score),
  }));
}

function normalizeCitationEvents(value: unknown): CitationEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "chat_citation_renderer",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    sourceId: typeof event.source_id === "string" ? event.source_id : "",
    citationId: typeof event.citation_id === "string" ? event.citation_id : "",
    timestamp: typeof event.timestamp === "string" ? event.timestamp : "",
  }));
}

function mergeCitationEvents(current: CitationEvent[], next: CitationEvent[]) {
  const byKey = new Map<string, CitationEvent>();
  [...current, ...next].forEach((event, index) => {
    byKey.set(`${event.phase}:${event.status}:${event.citationId}:${event.timestamp}:${index}`, event);
  });
  return [...byKey.values()].slice(-80);
}

function scoreLabel(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

export function ChatCitationRendererExample() {
  const [question, setQuestion] = useState(evidenceQuestion);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [answerSegments, setAnswerSegments] = useState<AnswerSegment[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [citationEvents, setCitationEvents] = useState<CitationEvent[]>([]);
  const [selectedCitationId, setSelectedCitationId] = useState("");
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const selectedCitation = citations.find((citation) => citation.id === selectedCitationId) ?? citations[0] ?? null;
  const selectedSource = selectedCitation
    ? sources.find((source) => source.id === selectedCitation.sourceId) ?? null
    : null;

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setSources([]);
    setAnswerSegments([]);
    setCitations([]);
    setCitationEvents([]);
    setSelectedCitationId("");
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function selectCitation(citation: Citation) {
    setSelectedCitationId(citation.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`citation-source-${citation.sourceId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  function applyValues(values: JsonRecord) {
    if (Array.isArray(values.sources)) setSources(normalizeSources(values.sources));
    if (Array.isArray(values.answer_segments)) setAnswerSegments(normalizeSegments(values.answer_segments));
    if (Array.isArray(values.citations)) {
      const nextCitations = normalizeCitations(values.citations);
      setCitations(nextCitations);
      setSelectedCitationId((current) => current || nextCitations[0]?.id || "");
    }
    if (Array.isArray(values.citation_events)) {
      setCitationEvents((current) => mergeCitationEvents(current, normalizeCitationEvents(values.citation_events)));
    }
    if (typeof values.answer === "string") setAnswer(values.answer);
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "chat_citation_renderer") return;
    setCitationEvents((current) => mergeCitationEvents(current, normalizeCitationEvents([data])));
  }

  async function runCitationRenderer(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setFinalStatus("running");
    setSources([]);
    setAnswerSegments([]);
    setCitations([]);
    setCitationEvents([]);
    setSelectedCitationId("");
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setStatus("Creating citation thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "24-chat-citation-renderer" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming citation renderer");
      const stream = await client.runs.stream(nextThreadId, "24_chat_citation_renderer", {
        input: { question: trimmed },
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 160));
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
      setFinalStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chat-citation-layout">
      <aside className="chat-citation-control">
        <div className="panel-title">
          <FileSearch aria-hidden="true" size={18} />
          Citation Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => setQuestion(evidenceQuestion)} disabled={busy}>
            <BookOpenText size={16} />
            Use evidence sample
          </button>
          <button type="button" className="secondary-button" onClick={() => setQuestion(streamQuestion)} disabled={busy}>
            <Link2 size={16} />
            Use stream sample
          </button>
        </div>
        <form className="run-form" onSubmit={runCitationRenderer}>
          <label className="field">
            <span>Citation question</span>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={6} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !question.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run citation renderer
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
            <span>Citations</span>
            <strong>{citations.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`citation-status-panel ${finalStatus}`} role="region" aria-label="Citation Status">
        <div className="panel-title">Citation Status</div>
        <div className="citation-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Sources</span>
            <strong>{sources.length}</strong>
          </div>
          <div>
            <span>Segments</span>
            <strong>{answerSegments.length}</strong>
          </div>
          <div>
            <span>Citations</span>
            <strong>{citations.length}</strong>
          </div>
        </div>
      </div>

      <div className="chat-answer-citations-panel" role="region" aria-label="Chat Answer With Citations">
        <div className="panel-title">Chat Answer With Citations</div>
        <div className="citation-chat-bubble">
          {answerSegments.length === 0 ? (
            <p className="muted">Run the graph to render answer segments with inline citation chips.</p>
          ) : (
            answerSegments.map((segment) => (
              <p key={segment.id} data-segment-id={segment.id}>
                <span>{segment.text}</span>
                {segment.citationIds.map((citationId) => {
                  const citation = citations.find((item) => item.id === citationId);
                  if (!citation) return null;
                  return (
                    <button
                      key={citation.id}
                      type="button"
                      className={selectedCitationId === citation.id ? "inline-citation-chip active" : "inline-citation-chip"}
                      onClick={() => selectCitation(citation)}
                    >
                      {citation.label}
                    </button>
                  );
                })}
              </p>
            ))
          )}
        </div>
      </div>

      <div className="citation-preview-panel" role="region" aria-label="Citation Preview">
        <div className="panel-title">Citation Preview</div>
        {selectedCitation && selectedSource ? (
          <article className="citation-preview-card">
            <strong>{selectedCitation.label} {selectedCitation.title}</strong>
            <a href={selectedCitation.url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              {selectedCitation.url}
            </a>
            <p>{selectedCitation.snippet}</p>
            <small>segment {selectedCitation.segmentId} / rank {selectedCitation.rank} / score {scoreLabel(selectedCitation.score)}</small>
          </article>
        ) : (
          <p className="muted">Select an inline citation chip to inspect the source preview.</p>
        )}
      </div>

      <div className="source-documents-panel" role="region" aria-label="Source Documents">
        <div className="panel-title">Source Documents</div>
        <div className="source-document-list">
          {sources.length === 0 ? (
            <p className="muted">Sources appear after retrieval.</p>
          ) : (
            sources.map((source) => (
              <article
                key={source.id}
                id={`citation-source-${source.id}`}
                className={selectedSource?.id === source.id ? "source-document-card highlighted" : "source-document-card"}
                data-source-id={source.id}
                data-highlighted={selectedSource?.id === source.id ? "true" : undefined}
              >
                <div>
                  <strong>{source.title}</strong>
                  <span>rank {source.rank}</span>
                </div>
                <code>source id: {source.id}</code>
                <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
                <p>{source.snippet}</p>
                <small>{source.sourceType} / score {scoreLabel(source.score)} / matched {source.matchedTerms.join(", ") || "none"}</small>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="citation-map-panel" role="region" aria-label="Citation Map">
        <div className="panel-title">Citation Map</div>
        <div className="citation-map-list">
          {citations.length === 0 ? (
            <p className="muted">Citation records will appear after metadata is linked.</p>
          ) : (
            citations.map((citation) => (
              <button
                key={citation.id}
                type="button"
                className={selectedCitationId === citation.id ? "citation-map-row active" : "citation-map-row"}
                onClick={() => selectCitation(citation)}
              >
                <strong>{citation.id}</strong>
                <span>{`segment ${citation.segmentId} -> source ${citation.sourceId}`}</span>
                <code>{citation.label}</code>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="final-answer-panel" role="region" aria-label="Final Answer">
        <div className="panel-title">Final Answer</div>
        <div className="answer-box compact-answer">{final || answer || "No final answer yet."}</div>
      </div>

      <div className="state-panel chat-citation-final-state" role="region" aria-label="Final State">
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
