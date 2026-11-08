import { ApprovalControls } from "./ApprovalControls";
import { ChatTranscript } from "./ChatTranscript";
import { CodeArtifact } from "./CodeArtifact";
import { CodeEditorEvents } from "./CodeEditorEvents";
import { CodeEditorStatus } from "./CodeEditorStatus";
import { DiffProposal } from "./DiffProposal";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { TestLog } from "./TestLog";
import { useChatCodeEditor } from "./useChatCodeEditor";
import { VersionHistory } from "./VersionHistory";

// Compose this example's independent controller and views.
export function ChatCodeEditorExample() {
  const example = useChatCodeEditor();
  return (
    <section className="code-editor-layout">
      <RuntimeControls {...example} />
      <CodeEditorStatus {...example} />
      <ChatTranscript {...example} />
      <CodeArtifact {...example} />
      <DiffProposal {...example} />
      <TestLog {...example} />
      <ApprovalControls {...example} />
      <VersionHistory {...example} />
      <CodeEditorEvents {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
