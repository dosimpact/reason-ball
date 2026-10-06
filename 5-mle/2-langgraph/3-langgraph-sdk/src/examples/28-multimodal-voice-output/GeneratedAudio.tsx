import { Download } from "lucide-react";

import type { useMultimodalVoiceOutput } from "./useMultimodalVoiceOutput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceOutput>,
  | "audioOutput"
>;

export function GeneratedAudio({
  audioOutput,
}: Props) {
  return (
    <div className="generated-audio-panel" role="region" aria-label="Generated Audio">
      <div className="panel-title">Generated Audio</div>
      {audioOutput?.dataUrl ? (
        <div className="generated-audio-frame">
          <audio controls src={audioOutput.dataUrl} />
          <a className="secondary-button download-link" href={audioOutput.dataUrl} download={audioOutput.filename}>
            <Download size={16} />
            Download audio
          </a>
        </div>
      ) : (
        <p className="muted">Generated audio appears after the graph finishes speech synthesis.</p>
      )}
    </div>
  );
}
