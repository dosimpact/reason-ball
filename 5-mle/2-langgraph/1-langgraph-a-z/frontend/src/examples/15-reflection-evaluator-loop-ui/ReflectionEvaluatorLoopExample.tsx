import { useReflectionEvaluatorLoop } from "./useReflectionEvaluatorLoop";
import { RuntimeControls } from "./RuntimeControls";
import {
  LoopStatusPanel,
  EvaluatorFeedbackPanel,
  IterationHistoryPanel,
  DraftComparisonPanel,
  LoopEventsPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function ReflectionEvaluatorLoopExample() {
  const model = useReflectionEvaluatorLoop();

  return (
    <section className="reflection-layout">
      <RuntimeControls {...model} />
      <LoopStatusPanel {...model} />
      <EvaluatorFeedbackPanel {...model} />
      <IterationHistoryPanel {...model} />
      <DraftComparisonPanel {...model} />
      <LoopEventsPanel {...model} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
