import type { useMultimodalVoiceOutput } from "./useMultimodalVoiceOutput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceOutput>,
  | "finalStatus"
  | "textAnswer"
  | "audioOutput"
  | "audioEvents"
>;

export function VoiceOutputStatus({
  finalStatus,
  textAnswer,
  audioOutput,
  audioEvents,
}: Props) {
  return (
    <div className={`voice-output-status-panel ${finalStatus}`} role="region" aria-label="Voice Output Status">
      <div className="panel-title">Voice Output Status</div>
      <div className="voice-output-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Text</span>
          <strong>{textAnswer ? "ready" : "pending"}</strong>
        </div>
        <div>
          <span>Audio</span>
          <strong>{audioOutput ? "ready" : "pending"}</strong>
        </div>
        <div>
          <span>Events</span>
          <strong>{audioEvents.length}</strong>
        </div>
      </div>
    </div>
  );
}
