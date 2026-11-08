import { useLongContext } from "./useLongContext";
import { RuntimeControls } from "./RuntimeControls";
import {
  ContextBudgetPanel,
  SummaryOfEarlierContextPanel,
  RecentMessagesPanel,
  SummarizedMessagesPanel,
  CompactionEventsPanel,
  AssistantAnswerPanel,
  LatestSummaryRecordPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function LongContextExample() {
  const model = useLongContext();

  return (
    <section className="long-context-layout">
      <RuntimeControls {...model} />
      <ContextBudgetPanel {...model} />
      <SummaryOfEarlierContextPanel {...model} />
      <RecentMessagesPanel {...model} />
      <SummarizedMessagesPanel {...model} />
      <CompactionEventsPanel {...model} />
      <AssistantAnswerPanel {...model} />
      <LatestSummaryRecordPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
