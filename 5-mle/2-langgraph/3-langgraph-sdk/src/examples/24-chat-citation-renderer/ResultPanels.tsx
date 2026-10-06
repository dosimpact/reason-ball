import { ExternalLink } from "lucide-react";
import { type Citation, scoreLabel } from "./data";
import { type ChatCitationRendererController } from "./useChatCitationRenderer";

// Typed display panels receive only the state and callbacks they render.
type CitationStatusPanelProps = Pick<
  ChatCitationRendererController,
  "finalStatus" | "sources" | "answerSegments" | "citations"
>;

export function CitationStatusPanel({
  finalStatus,
  sources,
  answerSegments,
  citations,
}: CitationStatusPanelProps) {
  return (
    <div
      className={`citation-status-panel ${finalStatus}`}
      role="region"
      aria-label="Citation Status"
    >
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
  );
}

type ChatAnswerWithCitationsPanelProps = Pick<
  ChatCitationRendererController,
  "answerSegments" | "citations" | "selectedCitationId"
> & { selectCitation: (citation: Citation) => void };

export function ChatAnswerWithCitationsPanel({
  answerSegments,
  citations,
  selectedCitationId,
  selectCitation,
}: ChatAnswerWithCitationsPanelProps) {
  return (
    <div
      className="chat-answer-citations-panel"
      role="region"
      aria-label="Chat Answer With Citations"
    >
      <div className="panel-title">Chat Answer With Citations</div>
      <div className="citation-chat-bubble">
        {answerSegments.length === 0 ? (
          <p className="muted">
            Run the graph to render answer segments with inline citation chips.
          </p>
        ) : (
          answerSegments.map((segment) => (
            <p key={segment.id} data-segment-id={segment.id}>
              <span>{segment.text}</span>
              {segment.citationIds.map((citationId) => {
                const citation = citations.find(
                  (item) => item.id === citationId,
                );
                if (!citation) return null;
                return (
                  <button
                    key={citation.id}
                    type="button"
                    className={
                      selectedCitationId === citation.id
                        ? "inline-citation-chip active"
                        : "inline-citation-chip"
                    }
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
  );
}

type CitationPreviewPanelProps = Pick<
  ChatCitationRendererController,
  "selectedCitation" | "selectedSource"
>;

export function CitationPreviewPanel({
  selectedCitation,
  selectedSource,
}: CitationPreviewPanelProps) {
  return (
    <div
      className="citation-preview-panel"
      role="region"
      aria-label="Citation Preview"
    >
      <div className="panel-title">Citation Preview</div>
      {selectedCitation && selectedSource ? (
        <article className="citation-preview-card">
          <strong>
            {selectedCitation.label} {selectedCitation.title}
          </strong>
          <a href={selectedCitation.url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
            {selectedCitation.url}
          </a>
          <p>{selectedCitation.snippet}</p>
          <small>
            segment {selectedCitation.segmentId} / rank {selectedCitation.rank}{" "}
            / score {scoreLabel(selectedCitation.score)}
          </small>
        </article>
      ) : (
        <p className="muted">
          Select an inline citation chip to inspect the source preview.
        </p>
      )}
    </div>
  );
}

type SourceDocumentsPanelProps = Pick<
  ChatCitationRendererController,
  "sources" | "selectedSource"
>;

export function SourceDocumentsPanel({
  sources,
  selectedSource,
}: SourceDocumentsPanelProps) {
  return (
    <div
      className="source-documents-panel"
      role="region"
      aria-label="Source Documents"
    >
      <div className="panel-title">Source Documents</div>
      <div className="source-document-list">
        {sources.length === 0 ? (
          <p className="muted">Sources appear after retrieval.</p>
        ) : (
          sources.map((source) => (
            <article
              key={source.id}
              id={`citation-source-${source.id}`}
              className={
                selectedSource?.id === source.id
                  ? "source-document-card highlighted"
                  : "source-document-card"
              }
              data-source-id={source.id}
              data-highlighted={
                selectedSource?.id === source.id ? "true" : undefined
              }
            >
              <div>
                <strong>{source.title}</strong>
                <span>rank {source.rank}</span>
              </div>
              <code>source id: {source.id}</code>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.url}
              </a>
              <p>{source.snippet}</p>
              <small>
                {source.sourceType} / score {scoreLabel(source.score)} / matched{" "}
                {source.matchedTerms.join(", ") || "none"}
              </small>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type CitationMapPanelProps = Pick<
  ChatCitationRendererController,
  "citations" | "selectedCitationId"
> & { selectCitation: (citation: Citation) => void };

export function CitationMapPanel({
  citations,
  selectedCitationId,
  selectCitation,
}: CitationMapPanelProps) {
  return (
    <div className="citation-map-panel" role="region" aria-label="Citation Map">
      <div className="panel-title">Citation Map</div>
      <div className="citation-map-list">
        {citations.length === 0 ? (
          <p className="muted">
            Citation records will appear after metadata is linked.
          </p>
        ) : (
          citations.map((citation) => (
            <button
              key={citation.id}
              type="button"
              className={
                selectedCitationId === citation.id
                  ? "citation-map-row active"
                  : "citation-map-row"
              }
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
  );
}

type FinalAnswerPanelProps = Pick<
  ChatCitationRendererController,
  "answer" | "final"
>;

export function FinalAnswerPanel({ answer, final }: FinalAnswerPanelProps) {
  return (
    <div className="final-answer-panel" role="region" aria-label="Final Answer">
      <div className="panel-title">Final Answer</div>
      <div className="answer-box compact-answer">
        {final || answer || "No final answer yet."}
      </div>
    </div>
  );
}
