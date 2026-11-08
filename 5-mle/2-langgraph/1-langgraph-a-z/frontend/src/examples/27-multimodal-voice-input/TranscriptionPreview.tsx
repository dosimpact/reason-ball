import { percent } from "./model";

import type { useMultimodalVoiceInput } from "./useMultimodalVoiceInput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceInput>,
  | "transcript"
  | "transcriptSource"
  | "transcriptConfidence"
  | "keyPhrases"
>;

export function TranscriptionPreview({
  transcript,
  transcriptSource,
  transcriptConfidence,
  keyPhrases,
}: Props) {
  return (
    <div className="transcription-preview-panel" role="region" aria-label="Transcription Preview">
      <div className="panel-title">Transcription Preview</div>
      <div className="answer-box compact-answer">{transcript || "Pending"}</div>
      {transcript ? (
        <div className="transcript-facts">
          <span>source {transcriptSource || "pending"}</span>
          <span>confidence {percent(transcriptConfidence)}%</span>
        </div>
      ) : null}
      {keyPhrases.length > 0 ? (
        <div className="key-phrase-list">
          {keyPhrases.map((phrase) => (
            <code key={phrase}>{phrase}</code>
          ))}
        </div>
      ) : null}
    </div>
  );
}
