import { seconds } from "./model";

import type { useMultimodalVoiceInput } from "./useMultimodalVoiceInput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceInput>,
  | "displayedMetadata"
>;

export function AudioMetadata({
  displayedMetadata,
}: Props) {
  return (
    <div className="audio-metadata-panel" role="region" aria-label="Audio Metadata">
      <div className="panel-title">Audio Metadata</div>
      <div className="audio-metadata-grid">
        <div>
          <span>Name</span>
          <strong>{displayedMetadata.name}</strong>
        </div>
        <div>
          <span>Type</span>
          <strong>{displayedMetadata.mimeType}</strong>
        </div>
        <div>
          <span>Size</span>
          <strong>{displayedMetadata.size} bytes</strong>
        </div>
        <div>
          <span>Duration</span>
          <strong>{seconds(displayedMetadata.durationMs)}</strong>
        </div>
      </div>
    </div>
  );
}
