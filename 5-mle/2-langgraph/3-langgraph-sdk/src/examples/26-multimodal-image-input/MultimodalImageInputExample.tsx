import { ImageAnalysis } from "./ImageAnalysis";
import { ImageAnalysisStatus } from "./ImageAnalysisStatus";
import { ImageEvents } from "./ImageEvents";
import { ImageMetadata } from "./ImageMetadata";
import { ImagePreview } from "./ImagePreview";
import { RegionNotes } from "./RegionNotes";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { useMultimodalImageInput } from "./useMultimodalImageInput";

// Compose this example's independent controller and views.
export function MultimodalImageInputExample() {
  const example = useMultimodalImageInput();
  return (
    <section className="image-input-layout">
      <RuntimeControls {...example} />
      <ImageAnalysisStatus {...example} />
      <ImagePreview {...example} />
      <ImageMetadata {...example} />
      <ImageAnalysis {...example} />
      <RegionNotes {...example} />
      <ImageEvents {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
