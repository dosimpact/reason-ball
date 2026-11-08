import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import { evidenceQuestion, type JsonRecord, type SourceDoc, type AnswerSegment, type Citation, type CitationEvent, normalizeSources, normalizeSegments, normalizeCitations, normalizeCitationEvents, mergeCitationEvents } from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useChatCitationRendererState() {
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

  const selectedCitation =
    citations.find((citation) => citation.id === selectedCitationId) ??
    citations[0] ??
    null;

  const selectedSource = selectedCitation
    ? (sources.find((source) => source.id === selectedCitation.sourceId) ??
      null)
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

  function applyValues(values: JsonRecord) {
    if (R.isArray(values.sources))
      setSources(normalizeSources(values.sources));
    if (R.isArray(values.answer_segments))
      setAnswerSegments(normalizeSegments(values.answer_segments));
    if (R.isArray(values.citations)) {
      const nextCitations = normalizeCitations(values.citations);
      setCitations(nextCitations);
      setSelectedCitationId((current) => current || nextCitations[0]?.id || "");
    }
    if (R.isArray(values.citation_events)) {
      setCitationEvents((current) =>
        mergeCitationEvents(
          current,
          normalizeCitationEvents(values.citation_events),
        ),
      );
    }
    if (R.isString(values.answer)) setAnswer(values.answer);
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status))
      setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "24_chat_citation_renderer") return;
    setCitationEvents((current) =>
      mergeCitationEvents(current, normalizeCitationEvents([data])),
    );
  }

  function prepareRunCitationRenderer() {
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
  }

  return {
    question,
    setQuestion,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    setFinalStatus,
    sources,
    answerSegments,
    citations,
    selectedCitationId,
    setSelectedCitationId,
    answer,
    final,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    selectedCitation,
    selectedSource,
    resetView,
    applyValues,
    applyCustomEvent,
    prepareRunCitationRenderer,
  };
}
