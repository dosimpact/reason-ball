import type { useMultimodalVoiceOutput } from "./useMultimodalVoiceOutput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceOutput>,
  | "textAnswer"
  | "final"
>;

export function TextResponse({
  textAnswer,
  final,
}: Props) {
  return (
    <div className="voice-text-panel" role="region" aria-label="Text Response">
      <div className="panel-title">Text Response</div>
      <div className="answer-box compact-answer">{final || textAnswer || "No text response yet."}</div>
    </div>
  );
}
