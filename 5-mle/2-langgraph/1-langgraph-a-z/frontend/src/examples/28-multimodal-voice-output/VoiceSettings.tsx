import { SlidersHorizontal } from "lucide-react";

import type { useMultimodalVoiceOutput } from "./useMultimodalVoiceOutput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceOutput>,
  | "effectiveSettings"
>;

export function VoiceSettings({
  effectiveSettings,
}: Props) {
  return (
    <div className="voice-settings-panel" role="region" aria-label="Voice Settings">
      <div className="panel-title">
        <SlidersHorizontal aria-hidden="true" size={16} />
        Voice Settings
      </div>
      <div className="voice-settings-grid">
        <div>
          <span>Voice</span>
          <strong>{effectiveSettings.voice}</strong>
        </div>
        <div>
          <span>Format</span>
          <strong>{effectiveSettings.responseFormat}</strong>
        </div>
        <div>
          <span>Model</span>
          <strong>{effectiveSettings.model}</strong>
        </div>
      </div>
      <p>{effectiveSettings.instructions}</p>
    </div>
  );
}
