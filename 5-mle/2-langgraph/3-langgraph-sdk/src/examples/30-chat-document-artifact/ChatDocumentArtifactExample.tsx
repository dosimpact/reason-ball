import { AIComments } from "./AIComments";
import { ApprovalControls } from "./ApprovalControls";
import { ArtifactCanvas } from "./ArtifactCanvas";
import { ChatTranscript } from "./ChatTranscript";
import { DocumentArtifactStatus } from "./DocumentArtifactStatus";
import { DocumentEvents } from "./DocumentEvents";
import { QualityReview } from "./QualityReview";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { SectionChanges } from "./SectionChanges";
import { useChatDocumentArtifact } from "./useChatDocumentArtifact";
import { VersionHistory } from "./VersionHistory";

// Compose this example's independent controller and views.
export function ChatDocumentArtifactExample() {
  const example = useChatDocumentArtifact();
  return (
    <section className="document-artifact-layout">
      <RuntimeControls {...example} />
      <DocumentArtifactStatus {...example} />
      <ChatTranscript {...example} />
      <ArtifactCanvas {...example} />
      <SectionChanges {...example} />
      <AIComments {...example} />
      <QualityReview {...example} />
      <ApprovalControls {...example} />
      <VersionHistory {...example} />
      <DocumentEvents {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
