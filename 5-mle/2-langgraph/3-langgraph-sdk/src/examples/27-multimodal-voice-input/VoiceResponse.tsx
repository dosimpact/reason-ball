import { percent } from "./model";

import type { useMultimodalVoiceInput } from "./useMultimodalVoiceInput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceInput>,
  | "responseNotes"
  | "answer"
  | "final"
>;

export function VoiceResponse({
  responseNotes,
  answer,
  final,
}: Props) {
  return (
    <div className="voice-response-panel" role="region" aria-label="Voice Response">
      <div className="panel-title">Voice Response</div>
      <div className="answer-box compact-answer">{final || answer || "No response yet."}</div>
      <div className="voice-note-list">
        {responseNotes.map((note) => (
          <article key={note.label} className="voice-note-card">
            <strong>{note.label}</strong>
            <p>{note.detail}</p>
            <span>confidence {percent(note.confidence)}%</span>
          </article>
        ))}
      </div>
    </div>
  );
}
