import { useState } from "react";
import { type DocumentState, initialDocument, type PendingOperation, predictPatch } from "./model";

export function usePredictiveStateUpdatesAgUiChatState() {
  const [documentState, setDocumentState] = useState<DocumentState>(initialDocument);

  const [pending, setPending] = useState<PendingOperation | null>(null);

  function startPrediction(operation: string) {
    const predicted = predictPatch(documentState, operation);
    const nextPending: PendingOperation = {
      id: `op-${documentState.revision + 1}`,
      operation,
      status: "pending",
      predictedTitle: predicted.title,
      predictedBody: predicted.body,
    };
    setPending(nextPending);
    setDocumentState({
      title: predicted.title,
      body: predicted.body,
      revision: documentState.revision + 1,
      lastOperation: `${operation}:pending`,
    });
  }

  function confirmPrediction(operation = pending?.operation ?? "manual") {
    setPending((current) => (current ? { ...current, status: "confirmed" } : current));
    setDocumentState((current) => ({
      ...current,
      lastOperation: `${operation}:confirmed`,
    }));
  }

  function revertPrediction() {
    setPending((current) => (current ? { ...current, status: "reverted" } : current));
    setDocumentState({
      ...initialDocument,
      revision: documentState.revision + 1,
      lastOperation: "reverted",
    });
  }

  function resetDocument() {
    setDocumentState(initialDocument);
    setPending(null);
  }

  function applyDocumentUpdate({ title, body, operation, status }: {
    title?: string; body?: string; operation: string; status: "confirmed" | "reverted";
  }) {
    if (status === "reverted") {
      revertPrediction();
      return { status: "reverted", document: initialDocument };
    }
    const nextDocument = {
      title: title ?? documentState.title,
      body: body ?? documentState.body,
      revision: documentState.revision + 1,
      lastOperation: `${operation}:confirmed`,
    };
    setDocumentState(nextDocument);
    setPending({
      id: `agent-${nextDocument.revision}`, operation, status: "confirmed",
      predictedTitle: nextDocument.title, predictedBody: nextDocument.body,
    });
    return { status: "confirmed", document: nextDocument };
  }

  return { documentState, setDocumentState, pending, startPrediction, confirmPrediction, resetDocument, applyDocumentUpdate };
}
