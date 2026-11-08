import { useIntentFeedbackGenerative } from "./useIntentFeedbackGenerative";
import { RuntimeControls } from "./RuntimeControls";
import {
  IntentStatusPanel,
  GeneratedUIRequestPanel,
  CompletedIntentPanel,
  QuoteSnapshotPanel,
  IntentEventsPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function IntentFeedbackGenerativeExample() {
  const model = useIntentFeedbackGenerative();

  return (
    <section className="intent-feedback-layout">
      <RuntimeControls {...model} />
      <IntentStatusPanel {...model} />
      <GeneratedUIRequestPanel {...model} />
      <CompletedIntentPanel {...model} />
      <QuoteSnapshotPanel {...model} />
      <IntentEventsPanel {...model} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
