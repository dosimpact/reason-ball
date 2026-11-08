import { ArtifactCanvas } from "./ArtifactCanvas";
import { BoardActions } from "./BoardActions";
import { ChatTranscript } from "./ChatTranscript";
import { ExecutionLog } from "./ExecutionLog";
import { PlanBoardStatus } from "./PlanBoardStatus";
import { PlanEvents } from "./PlanEvents";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { useChatPlanBoard } from "./useChatPlanBoard";
import { VersionHistory } from "./VersionHistory";

// Compose this example's independent controller and views.
export function ChatPlanBoardExample() {
  const example = useChatPlanBoard();
  return (
    <section className="plan-board-layout">
      <RuntimeControls {...example} />
      <PlanBoardStatus {...example} />
      <ChatTranscript {...example} />
      <ArtifactCanvas {...example} />
      <BoardActions {...example} />
      <ExecutionLog {...example} />
      <VersionHistory {...example} />
      <PlanEvents {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
