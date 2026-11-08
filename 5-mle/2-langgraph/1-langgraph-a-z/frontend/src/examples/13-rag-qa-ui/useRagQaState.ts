import { isArray, isString, isBoolean } from "remeda";
import { useMemo, useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import {
  samples,
  type JsonRecord,
  type RetrievedDoc,
  type Citation,
  normalizeDocs,
  normalizeCitations,
} from "./data";

// Owns local state, derived selectors and state transitions; performs no SDK calls.
export function useRagQaState() {
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

  const retrievedIds = useMemo(
    () => retrievedDocs.map((doc) => doc.id).join(", "),
    [retrievedDocs],
  );

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
    if (isArray(values.retrieved_docs)) {
      setRetrievedDocs(normalizeDocs(values.retrieved_docs));
    }
    if (isString(values.answer)) {
      setAnswer(values.answer);
    }
    if (isArray(values.citations)) {
      const nextCitations = normalizeCitations(values.citations);
      setCitations(nextCitations);
      if (!highlightedDocId && nextCitations[0]?.docId) {
        setHighlightedDocId(nextCitations[0].docId);
      }
    }
    if (isBoolean(values.citation_ok)) {
      setCitationOk(values.citation_ok);
    }
    if (isString(values.qa_status)) {
      setQaStatus(values.qa_status);
    }
    if (isString(values.fallback_reason)) {
      setFallbackReason(values.fallback_reason);
    }
    if (isString(values.final)) {
      setFinal(values.final);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function prepareRunRagQa() {
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
  }

  return {
    question,
    setQuestion,
    threadId,
    setThreadId,
    status,
    setStatus,
    qaStatus,
    retrievedDocs,
    answer,
    citations,
    citationOk,
    fallbackReason,
    final,
    highlightedDocId,
    setHighlightedDocId,
    finalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    retrievedIds,
    resetView,
    applyValues,
    prepareRunRagQa,
  };
}
