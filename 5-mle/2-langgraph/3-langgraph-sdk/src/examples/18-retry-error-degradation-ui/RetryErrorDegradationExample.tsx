import { useRetryErrorDegradation } from "./useRetryErrorDegradation";
import { RuntimeControls } from "./RuntimeControls";
import {
  RunStatusPanel,
  RetryTimelinePanel,
  ErrorDetailsPanel,
  FallbackResultPanel,
  RetryEventsPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function RetryErrorDegradationExample() {
  const model = useRetryErrorDegradation();

  return (
    <section className="retry-layout">
      <RuntimeControls {...model} />
      <RunStatusPanel {...model} />
      <RetryTimelinePanel {...model} />
      <ErrorDetailsPanel {...model} />
      <FallbackResultPanel {...model} />
      <RetryEventsPanel {...model} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
