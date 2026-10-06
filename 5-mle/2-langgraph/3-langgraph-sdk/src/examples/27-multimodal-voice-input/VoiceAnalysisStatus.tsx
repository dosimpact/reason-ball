import type { useMultimodalVoiceInput } from "./useMultimodalVoiceInput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceInput>,
  | "finalStatus"
  | "transcript"
  | "keyPhrases"
  | "voiceEvents"
>;

export function VoiceAnalysisStatus({
  finalStatus,
  transcript,
  keyPhrases,
  voiceEvents,
}: Props) {
  return (
    <div className={`voice-status-panel ${finalStatus}`} role="region" aria-label="Voice Analysis Status">
      <div className="panel-title">Voice Analysis Status</div>
      <div className="voice-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Transcript</span>
          <strong>{transcript ? "ready" : "pending"}</strong>
        </div>
        <div>
          <span>Key Phrases</span>
          <strong>{keyPhrases.length}</strong>
        </div>
        <div>
          <span>Events</span>
          <strong>{voiceEvents.length}</strong>
        </div>
      </div>
    </div>
  );
}
