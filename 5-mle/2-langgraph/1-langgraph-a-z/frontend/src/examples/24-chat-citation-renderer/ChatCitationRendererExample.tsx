import { type Citation } from "./data";
import { useChatCitationRenderer } from "./useChatCitationRenderer";
import { RuntimeControls } from "./RuntimeControls";
import {
  CitationStatusPanel,
  ChatAnswerWithCitationsPanel,
  CitationPreviewPanel,
  SourceDocumentsPanel,
  CitationMapPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function ChatCitationRendererExample() {
  const model = useChatCitationRenderer();
  const { setSelectedCitationId } = model;

  function selectCitation(citation: Citation) {
    setSelectedCitationId(citation.id);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`citation-source-${citation.sourceId}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
    });
  }

  return (
    <section className="chat-citation-layout">
      <RuntimeControls {...model} />
      <CitationStatusPanel {...model} />
      <ChatAnswerWithCitationsPanel
        {...model}
        selectCitation={selectCitation}
      />
      <CitationPreviewPanel {...model} />
      <SourceDocumentsPanel {...model} />
      <CitationMapPanel {...model} selectCitation={selectCitation} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
