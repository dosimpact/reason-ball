import { useRagQa } from "./useRagQa";
import { RuntimeControls } from "./RuntimeControls";
import {
  RetrievalStatusPanel,
  AnswerPanel,
  RetrievedDocumentsPanel,
  CitationTrailPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function RagQaExample() {
  const model = useRagQa();
  const { setHighlightedDocId } = model;

  function focusCitation(docId: string) {
    setHighlightedDocId(docId);
    window.requestAnimationFrame(() => {
      document.getElementById(`rag-doc-${docId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  return (
    <section className="rag-layout">
      <RuntimeControls {...model} />
      <RetrievalStatusPanel {...model} />
      <AnswerPanel {...model} focusCitation={focusCitation} />
      <RetrievedDocumentsPanel {...model} />
      <CitationTrailPanel {...model} focusCitation={focusCitation} />
      <RunDiagnostics {...model} />
    </section>
  );
}
