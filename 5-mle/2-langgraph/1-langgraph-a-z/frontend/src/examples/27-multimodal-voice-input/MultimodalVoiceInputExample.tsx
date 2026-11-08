import { AudioMetadata } from "./AudioMetadata";
import { AudioPreview } from "./AudioPreview";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { TranscriptionPreview } from "./TranscriptionPreview";
import { useMultimodalVoiceInput } from "./useMultimodalVoiceInput";
import { VoiceAnalysisStatus } from "./VoiceAnalysisStatus";
import { VoiceEvents } from "./VoiceEvents";
import { VoiceResponse } from "./VoiceResponse";

// Compose this example's independent controller and views.
export function MultimodalVoiceInputExample() {
  const example = useMultimodalVoiceInput();
  return (
    <section className="voice-input-layout">
      <RuntimeControls {...example} />
      <VoiceAnalysisStatus {...example} />
      <AudioPreview {...example} />
      <AudioMetadata {...example} />
      <TranscriptionPreview {...example} />
      <VoiceResponse {...example} />
      <VoiceEvents {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
