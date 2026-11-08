import { useCustomEventRenderer } from "./useCustomEventRenderer";
import { RuntimeControls } from "./RuntimeControls";
import {
  RendererStatusPanel,
  InlineEventRendererPanel,
  PhaseProgressPanel,
  WarningEventsPanel,
  UnknownEventInspectorPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function CustomEventRendererExample() {
  const model = useCustomEventRenderer();

  return (
    <section className="custom-event-layout">
      <RuntimeControls {...model} />
      <RendererStatusPanel {...model} />
      <InlineEventRendererPanel {...model} />
      <PhaseProgressPanel {...model} />
      <WarningEventsPanel {...model} />
      <UnknownEventInspectorPanel {...model} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
