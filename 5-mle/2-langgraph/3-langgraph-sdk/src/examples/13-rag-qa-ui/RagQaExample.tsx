import { BookOpenText, FileSearch, Link2, Loader2, Play, RotateCcw, Quote } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";


const samples = [
  {
    label: "Evidence UI",
    value: "How should a LangGraph SDK RAG UI show retrieved documents, citation chips, and the supporting answer?",
  },
  {
    label: "Streaming Modes",
    value: "Which LangGraph SDK stream modes should a UI expose for graph updates and custom progress?",
  },
  {
    label: "No Document",
    value: "What does this local corpus say about Kubernetes pod scheduling?",
  },
];

type JsonRecord = Record<string, unknown>;

type RetrievedDoc = {
  id: string;
  rank: number;
  title: string;
  source: string;
  score: number;
  snippet: string;
  text: string;
  matchedTerms: string[];
};

type Citation = {
  id: string;
  docId: string;
  label: string;
  title: string;
  rank: number;
  score: number;
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

function normalizeDocs(value: unknown): RetrievedDoc[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((doc, index) => ({
    id: typeof doc.id === "string" ? doc.id : `doc-${index + 1}`,
    rank: typeof doc.rank === "number" ? doc.rank : index + 1,
    title: typeof doc.title === "string" ? doc.title : `Document ${index + 1}`,
    source: typeof doc.source === "string" ? doc.source : "local fixture",
    score: typeof doc.score === "number" ? doc.score : Number(doc.score ?? 0),
    snippet: typeof doc.snippet === "string" ? doc.snippet : "",
    text: typeof doc.text === "string" ? doc.text : "",
    matchedTerms: Array.isArray(doc.matched_terms)
      ? doc.matched_terms.map((term) => String(term))
      : [],
  }));
}

function normalizeCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((citation, index) => {
    const docId = typeof citation.doc_id === "string" ? citation.doc_id : String(citation.docId ?? "");
    return {
      id: typeof citation.id === "string" ? citation.id : `cite-${index + 1}`,
      docId,
      label: typeof citation.label === "string" ? citation.label : docId ? `[${docId}]` : `[cite-${index + 1}]`,
      title: typeof citation.title === "string" ? citation.title : docId,
      rank: typeof citation.rank === "number" ? citation.rank : index + 1,
      score: typeof citation.score === "number" ? citation.score : Number(citation.score ?? 0),
    };
  });
}

function scoreLabel(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

export function RagQaExample() {
  const [question, setQuestion] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [qaStatus, setQaStatus] = useState("idle");
  const [retrievedDocs, setRetrievedDocs] = useState<RetrievedDoc[]>([]);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [citationOk, setCitationOk] = useState(false);
  const [fallbackReason, setFallbackReason] = useState("");
  const [final, setFinal] = useState("");
  const [highlightedDocId, setHighlightedDocId] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const retrievedIds = useMemo(() => retrievedDocs.map((doc) => doc.id).join(", "), [retrievedDocs]);

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setQaStatus("idle");
    setRetrievedDocs([]);
    setAnswer("");
    setCitations([]);
    setCitationOk(false);
    setFallbackReason("");
    setFinal("");
    setHighlightedDocId("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (Array.isArray(values.retrieved_docs)) {
      setRetrievedDocs(normalizeDocs(values.retrieved_docs));
    }
    if (typeof values.answer === "string") {
      setAnswer(values.answer);
    }
    if (Array.isArray(values.citations)) {
      const nextCitations = normalizeCitations(values.citations);
      setCitations(nextCitations);
      if (!highlightedDocId && nextCitations[0]?.docId) {
        setHighlightedDocId(nextCitations[0].docId);
      }
    }
    if (typeof values.citation_ok === "boolean") {
      setCitationOk(values.citation_ok);
    }
    if (typeof values.qa_status === "string") {
      setQaStatus(values.qa_status);
    }
    if (typeof values.fallback_reason === "string") {
      setFallbackReason(values.fallback_reason);
    }
    if (typeof values.final === "string") {
      setFinal(values.final);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function focusCitation(docId: string) {
    setHighlightedDocId(docId);
    window.requestAnimationFrame(() => {
      document.getElementById(`rag-doc-${docId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  async function runRagQa(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setQaStatus("idle");
    setRetrievedDocs([]);
    setAnswer("");
    setCitations([]);
    setCitationOk(false);
    setFallbackReason("");
    setFinal("");
    setHighlightedDocId("");
    setFinalState(null);
    setStatus("Creating RAG QA thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "13-rag-qa-ui", question: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming RAG QA");

      const stream = await client.runs.stream(nextThreadId, "13_rag_qa", {
        input: { question: trimmed },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 100));
        for (const payload of nodePayloads(logEntry.data)) {
          applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      applyValues(values);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rag-layout">
      <aside className="rag-control">
        <div className="panel-title">
          <FileSearch aria-hidden="true" size={18} />
          RAG Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="sample-list" aria-label="RAG QA samples">
          {samples.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="sample-button"
              onClick={() => setQuestion(sample.value)}
              disabled={busy}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <form onSubmit={runRagQa} className="run-form">
          <label className="field">
            <span>Question</span>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={6} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !question.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run RAG QA
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
            <span>Docs</span>
            <strong>{retrievedDocs.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`retrieval-status-panel ${qaStatus}`} role="region" aria-label="Retrieval Status">
        <div className="panel-title">
          <BookOpenText aria-hidden="true" size={18} />
          Retrieval Status
        </div>
        <div className="rag-status-grid">
          <div>
            <span>QA Status</span>
            <strong>{qaStatus}</strong>
          </div>
          <div>
            <span>Citation Check</span>
            <strong>{citationOk ? "passed" : "pending"}</strong>
          </div>
          <div>
            <span>Retrieved IDs</span>
            <strong>{retrievedIds || "none"}</strong>
          </div>
        </div>
        {fallbackReason ? <p className="fallback-line">{fallbackReason}</p> : null}
        {final ? <p className="final-line">{final}</p> : null}
      </div>

      <div className="answer-panel" role="region" aria-label="Answer">
        <div className="panel-title">
          <Quote aria-hidden="true" size={18} />
          Answer
        </div>
        <div className="answer-box">{answer || "Run a question to generate a cited answer."}</div>
        <div className="citation-chip-row" aria-label="Answer citation chips">
          {citations.length === 0 ? (
            <span className="muted">No citations yet.</span>
          ) : (
            citations.map((citation) => (
              <button
                key={citation.id}
                type="button"
                className={highlightedDocId === citation.docId ? "citation-chip active" : "citation-chip"}
                onClick={() => focusCitation(citation.docId)}
              >
                <Link2 aria-hidden="true" size={14} />
                {citation.label}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="retrieved-docs-panel" role="region" aria-label="Retrieved Documents">
        <div className="panel-title">Retrieved Documents</div>
        <div className="document-card-list">
          {retrievedDocs.length === 0 ? (
            <p className="muted">No retrieved documents yet.</p>
          ) : (
            retrievedDocs.map((doc) => (
              <article
                key={doc.id}
                id={`rag-doc-${doc.id}`}
                className={highlightedDocId === doc.id ? "document-card highlighted" : "document-card"}
                data-doc-id={doc.id}
                data-source-id={doc.id}
                data-highlighted={highlightedDocId === doc.id ? "true" : undefined}
              >
                <div className="document-card-header">
                  <strong>{doc.title}</strong>
                  <span>rank {doc.rank}</span>
                </div>
                <div className="document-metadata">
                  <code>source id: {doc.id}</code>
                  <code>source: {doc.source}</code>
                  <code>score: {scoreLabel(doc.score)}</code>
                </div>
                <p className="document-snippet">
                  <strong>Snippet:</strong> {doc.snippet}
                </p>
                <p className="matched-terms">
                  <strong>Matched terms:</strong> {doc.matchedTerms.join(", ") || "none"}
                </p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="citation-panel" role="region" aria-label="Citation Trail">
        <div className="panel-title">Citation Trail</div>
        {citations.length === 0 ? (
          <p className="muted">Citation records will appear after an answer is grounded.</p>
        ) : (
          <ol className="citation-list">
            {citations.map((citation) => (
              <li key={citation.id}>
                <button type="button" className="citation-link" onClick={() => focusCitation(citation.docId)}>
                  {citation.label}
                </button>
                <span>{citation.title}</span>
                <code>rank {citation.rank} score {scoreLabel(citation.score)}</code>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="state-panel rag-final-state" role="region" aria-label="Final State">
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
