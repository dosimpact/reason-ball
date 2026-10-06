import { percent } from "./model";

import type { useMultimodalImageInput } from "./useMultimodalImageInput";

type Props = Pick<
  ReturnType<typeof useMultimodalImageInput>,
  | "observations"
  | "answer"
  | "final"
>;

export function ImageAnalysis({
  observations,
  answer,
  final,
}: Props) {
  return (
    <div className="image-analysis-panel" role="region" aria-label="Image Analysis">
      <div className="panel-title">Image Analysis</div>
      <div className="answer-box compact-answer">{final || answer || "No image analysis yet."}</div>
      <div className="observation-list">
        {observations.map((observation) => (
          <article key={observation.label} className="observation-card">
            <strong>{observation.label}</strong>
            <p>{observation.detail}</p>
            <span>confidence {percent(observation.confidence)}%</span>
          </article>
        ))}
      </div>
    </div>
  );
}
