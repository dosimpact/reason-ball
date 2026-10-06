import { useObservability } from "./useObservability";
import { RuntimeControls } from "./RuntimeControls";
import {
  RunMetricsPanel,
  NodeTimingsPanel,
  TokenUsagePanel,
  CostEstimatePanel,
  TraceLinksPanel,
  RunMetadataPanel,
  ObservabilityEventsPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function ObservabilityExample() {
  const model = useObservability();

  return (
    <section className="observability-layout">
      <RuntimeControls {...model} />
      <RunMetricsPanel {...model} />
      <NodeTimingsPanel {...model} />
      <TokenUsagePanel {...model} />
      <CostEstimatePanel {...model} />
      <TraceLinksPanel {...model} />
      <RunMetadataPanel {...model} />
      <ObservabilityEventsPanel {...model} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
