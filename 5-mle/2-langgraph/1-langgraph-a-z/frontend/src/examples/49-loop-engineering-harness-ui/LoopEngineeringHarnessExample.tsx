import { ArtifactCanvas } from "./ArtifactCanvas";
import { ArtifactInspector } from "./ArtifactInspector";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { useLoopEngineeringHarness } from "./useLoopEngineeringHarness";

// Compose this example's independent controller and views.
export function LoopEngineeringHarnessExample() {
  const example = useLoopEngineeringHarness();
  return (
    <section className="artifact-layout">
      <RuntimeControls {...example} />
      <ArtifactCanvas {...example} />
      <ArtifactInspector {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
