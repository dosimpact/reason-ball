import { BookOpenText, Link2, Quote } from "lucide-react";
import { scoreLabel } from "./data";
import { type RagQaController } from "./useRagQa";

// Typed display panels receive only the state and callbacks they render.
type RetrievalStatusPanelProps = Pick<
  RagQaController,
  "qaStatus" | "citationOk" | "fallbackReason" | "final" | "retrievedIds"
>;

export function RetrievalStatusPanel({
  qaStatus,
  citationOk,
  fallbackReason,
  final,
  retrievedIds,
}: RetrievalStatusPanelProps) {
  return (
    <div
      className={`retrieval-status-panel ${qaStatus}`}
      role="region"
      aria-label="Retrieval Status"
    >
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
      {fallbackReason ? (
        <p className="fallback-line">{fallbackReason}</p>
      ) : null}
      {final ? <p className="final-line">{final}</p> : null}
    </div>
  );
}

type AnswerPanelProps = Pick<
  RagQaController,
  "answer" | "citations" | "highlightedDocId"
> & { focusCitation: (docId: string) => void };

export function AnswerPanel({
  answer,
  citations,
  highlightedDocId,
  focusCitation,
}: AnswerPanelProps) {
  return (
    <div className="answer-panel" role="region" aria-label="Answer">
      <div className="panel-title">
        <Quote aria-hidden="true" size={18} />
        Answer
      </div>
      <div className="answer-box">
        {answer || "Run a question to generate a cited answer."}
      </div>
      <div className="citation-chip-row" aria-label="Answer citation chips">
        {citations.length === 0 ? (
          <span className="muted">No citations yet.</span>
        ) : (
          citations.map((citation) => (
            <button
              key={citation.id}
              type="button"
              className={
                highlightedDocId === citation.docId
                  ? "citation-chip active"
                  : "citation-chip"
              }
              onClick={() => focusCitation(citation.docId)}
            >
              <Link2 aria-hidden="true" size={14} />
              {citation.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

type RetrievedDocumentsPanelProps = Pick<
  RagQaController,
  "retrievedDocs" | "highlightedDocId"
>;

export function RetrievedDocumentsPanel({
  retrievedDocs,
  highlightedDocId,
}: RetrievedDocumentsPanelProps) {
  return (
    <div
      className="retrieved-docs-panel"
      role="region"
      aria-label="Retrieved Documents"
    >
      <div className="panel-title">Retrieved Documents</div>
      <div className="document-card-list">
        {retrievedDocs.length === 0 ? (
          <p className="muted">No retrieved documents yet.</p>
        ) : (
          retrievedDocs.map((doc) => (
            <article
              key={doc.id}
              id={`rag-doc-${doc.id}`}
              className={
                highlightedDocId === doc.id
                  ? "document-card highlighted"
                  : "document-card"
              }
              data-doc-id={doc.id}
              data-source-id={doc.id}
              data-highlighted={
                highlightedDocId === doc.id ? "true" : undefined
              }
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
                <strong>Matched terms:</strong>{" "}
                {doc.matchedTerms.join(", ") || "none"}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type CitationTrailPanelProps = Pick<RagQaController, "citations"> & {
  focusCitation: (docId: string) => void;
};

export function CitationTrailPanel({
  citations,
  focusCitation,
}: CitationTrailPanelProps) {
  return (
    <div className="citation-panel" role="region" aria-label="Citation Trail">
      <div className="panel-title">Citation Trail</div>
      {citations.length === 0 ? (
        <p className="muted">
          Citation records will appear after an answer is grounded.
        </p>
      ) : (
        <ol className="citation-list">
          {citations.map((citation) => (
            <li key={citation.id}>
              <button
                type="button"
                className="citation-link"
                onClick={() => focusCitation(citation.docId)}
              >
                {citation.label}
              </button>
              <span>{citation.title}</span>
              <code>
                rank {citation.rank} score {scoreLabel(citation.score)}
              </code>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
