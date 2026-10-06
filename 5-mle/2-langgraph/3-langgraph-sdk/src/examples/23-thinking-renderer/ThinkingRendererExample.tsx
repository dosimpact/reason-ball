import { useThinkingRenderer } from "./useThinkingRenderer";
import { RuntimeControls } from "./RuntimeControls";
import {
  ThinkingStatusPanel,
  ThinkingTimelinePanel,
  PublicReasoningSummaryPanel,
  SafetyGuardrailsPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function ThinkingRendererExample() {
  const model = useThinkingRenderer();

  return (
    <section className="thinking-layout">
      <RuntimeControls {...model} />
      <ThinkingStatusPanel {...model} />
      <ThinkingTimelinePanel {...model} />
      <PublicReasoningSummaryPanel {...model} />
      <SafetyGuardrailsPanel {...model} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
