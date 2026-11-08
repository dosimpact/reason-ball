import { useLongTermMemory } from "./useLongTermMemory";
import { RuntimeControls } from "./RuntimeControls";
import {
  DurableMemoriesPanel,
  ThreadStatePanel,
  CrossThreadProofPanel,
  MemoryEventsPanel,
  FinalAnswerPanel,
} from "./ResultPanels";
import { RunDiagnostics } from "./RunDiagnostics";

// Compose independent example-local request, state and display layers.
export function LongTermMemoryExample() {
  const model = useLongTermMemory();

  return (
    <section className="memory-layout">
      <RuntimeControls {...model} />
      <DurableMemoriesPanel {...model} />
      <ThreadStatePanel {...model} />
      <CrossThreadProofPanel {...model} />
      <MemoryEventsPanel {...model} />
      <FinalAnswerPanel {...model} />
      <RunDiagnostics {...model} />
    </section>
  );
}
