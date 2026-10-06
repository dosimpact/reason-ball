import { AudioMetadata } from "./AudioMetadata";
import { GeneratedAudio } from "./GeneratedAudio";
import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { TextResponse } from "./TextResponse";
import { useMultimodalVoiceOutput } from "./useMultimodalVoiceOutput";
import { VoiceOutputEvents } from "./VoiceOutputEvents";
import { VoiceOutputStatus } from "./VoiceOutputStatus";
import { VoiceSettings } from "./VoiceSettings";

// Compose this example's independent controller and views.
export function MultimodalVoiceOutputExample() {
  const example = useMultimodalVoiceOutput();
  return (
    <section className="voice-output-layout">
      <RuntimeControls {...example} />
      <VoiceOutputStatus {...example} />
      <VoiceSettings {...example} />
      <TextResponse {...example} />
      <GeneratedAudio {...example} />
      <AudioMetadata {...example} />
      <VoiceOutputEvents {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
