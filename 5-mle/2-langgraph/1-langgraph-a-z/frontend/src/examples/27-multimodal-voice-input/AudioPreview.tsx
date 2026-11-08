import type { useMultimodalVoiceInput } from "./useMultimodalVoiceInput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceInput>,
  | "audioDataUrl"
>;

export function AudioPreview({
  audioDataUrl,
}: Props) {
  return (
    <div className="audio-preview-panel" role="region" aria-label="Audio Preview">
      <div className="panel-title">Audio Preview</div>
      {audioDataUrl ? (
        <div className="audio-preview-frame">
          <audio controls src={audioDataUrl} />
          <div className="audio-waveform" aria-hidden="true">
            {Array.from({ length: 24 }, (_, index) => (
              <span key={index} style={{ height: `${22 + ((index * 17) % 42)}px` }} />
            ))}
          </div>
        </div>
      ) : (
        <p className="muted">Upload audio or use the sample voice note before running the graph.</p>
      )}
    </div>
  );
}
