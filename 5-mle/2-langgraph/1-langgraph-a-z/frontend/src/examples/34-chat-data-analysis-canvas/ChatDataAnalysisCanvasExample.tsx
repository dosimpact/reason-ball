import { AnalysisEvents } from "./AnalysisEvents";
import { AnalysisStatus } from "./AnalysisStatus";
import { AnalysisSteps } from "./AnalysisSteps";
import { ArtifactCanvas } from "./ArtifactCanvas";
import { ChatTranscript } from "./ChatTranscript";
import { DatasetPreview } from "./DatasetPreview";
import { GeneratedCode } from "./GeneratedCode";
import { Insights } from "./Insights";
import { ResultTable } from "./ResultTable";
import { RetryControls } from "./RetryControls";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { SandboxLogs } from "./SandboxLogs";
import { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

// Compose this example's independent controller and views.
export function ChatDataAnalysisCanvasExample() {
  const example = useChatDataAnalysisCanvas();
  return (
    <section className="data-canvas-layout">
      <RuntimeControls {...example} />
      <AnalysisStatus {...example} />
      <ChatTranscript {...example} />
      <DatasetPreview {...example} />
      <GeneratedCode {...example} />
      <ResultTable {...example} />
      <ArtifactCanvas {...example} />
      <SandboxLogs {...example} />
      <RetryControls {...example} />
      <AnalysisSteps {...example} />
      <Insights {...example} />
      <AnalysisEvents {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
