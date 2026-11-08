import { ApprovalControls } from "./ApprovalControls";
import { ChatTranscript } from "./ChatTranscript";
import { ComponentCode } from "./ComponentCode";
import { ComponentTree } from "./ComponentTree";
import { DiffPreview } from "./DiffPreview";
import { LivePreview } from "./LivePreview";
import { PreviewEvents } from "./PreviewEvents";
import { PreviewStatus } from "./PreviewStatus";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { StyleControls } from "./StyleControls";
import { useChatUiPreview } from "./useChatUiPreview";
import { VersionHistory } from "./VersionHistory";

// Compose this example's independent controller and views.
export function ChatUiPreviewExample() {
  const example = useChatUiPreview();
  return (
    <section className="ui-preview-layout">
      <RuntimeControls {...example} />
      <PreviewStatus {...example} />
      <ChatTranscript {...example} />
      <LivePreview {...example} />
      <ComponentCode {...example} />
      <DiffPreview {...example} />
      <ComponentTree {...example} />
      <StyleControls {...example} />
      <ApprovalControls {...example} />
      <VersionHistory {...example} />
      <PreviewEvents {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
