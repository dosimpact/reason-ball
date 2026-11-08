import { useConfigurableAssistant } from "./useConfigurableAssistant";
import { RuntimeControls } from "./RuntimeControls";
import {
  RunStatusPanel,
  EffectiveConfigPanel,
  OutputComparisonPanel,
  ConfigDiffPanel,
  ConfigEventsPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function ConfigurableAssistantExample() {
  const model = useConfigurableAssistant();

  return (
    <section className="configurable-layout">
      <RuntimeControls {...model} />
      <RunStatusPanel {...model} />
      <EffectiveConfigPanel {...model} />
      <OutputComparisonPanel {...model} />
      <ConfigDiffPanel {...model} />
      <ConfigEventsPanel {...model} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
