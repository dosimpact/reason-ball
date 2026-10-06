import type { useMultimodalVoiceOutput } from "./useMultimodalVoiceOutput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceOutput>,
  | "voice"
  | "audioOutput"
>;

export function AudioMetadata({
  voice,
  audioOutput,
}: Props) {
  return (
    <div className="voice-output-metadata-panel" role="region" aria-label="Audio Metadata">
      <div className="panel-title">Audio Metadata</div>
      <div className="voice-output-metadata-grid">
        <div>
          <span>File</span>
          <strong>{audioOutput?.filename || "none"}</strong>
        </div>
        <div>
          <span>Type</span>
          <strong>{audioOutput?.mimeType || "unknown"}</strong>
        </div>
        <div>
          <span>Size</span>
          <strong>{audioOutput?.size ?? 0} bytes</strong>
        </div>
        <div>
          <span>Voice</span>
          <strong>{audioOutput?.voice || voice}</strong>
        </div>
      </div>
    </div>
  );
}
