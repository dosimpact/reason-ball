import { usePlanAndExecute } from "./usePlanAndExecute";
import { RuntimeControls } from "./RuntimeControls";
import {
  ExecutionStatusPanel,
  ReplanStopControlsPanel,
  PlanStepsPanel,
  ExecutorOutputPanel,
  StepEventsPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function PlanAndExecuteExample() {
  const model = usePlanAndExecute();

  return (
    <section className="plan-execute-layout">
      <RuntimeControls {...model} />
      <ExecutionStatusPanel {...model} />
      <ReplanStopControlsPanel {...model} />
      <PlanStepsPanel {...model} />
      <ExecutorOutputPanel {...model} />
      <StepEventsPanel {...model} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
