import { ArtifactInspector } from "./ArtifactInspector";
import { CanvasEvents } from "./CanvasEvents";
import { ChatTranscript } from "./ChatTranscript";
import { CheckpointTimeline } from "./CheckpointTimeline";
import { DebuggerStatus } from "./DebuggerStatus";
import { GraphCanvas } from "./GraphCanvas";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { StateDiff } from "./StateDiff";
import { TimeTravelReplay } from "./TimeTravelReplay";
import { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";
import { VersionHistory } from "./VersionHistory";

// Compose this example's independent controller and views.
export function ChatGraphExecutionCanvasExample() {
  const example = useChatGraphExecutionCanvas();
  return (
    <section className="graph-canvas-layout">
      <RuntimeControls {...example} />
      <DebuggerStatus {...example} />
      <ChatTranscript {...example} />
      <GraphCanvas {...example} />
      <ArtifactInspector {...example} />
      <CheckpointTimeline {...example} />
      <StateDiff {...example} />
      <TimeTravelReplay {...example} />
      <VersionHistory {...example} />
      <CanvasEvents {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
