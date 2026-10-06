import { ClipboardCheck } from "lucide-react";

import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
  | "qualityChecks"
>;

export function QualityReview({
  qualityChecks,
}: Props) {
  return (
    <div className="quality-review-panel" role="region" aria-label="Quality Review">
      <div className="panel-title">
        <ClipboardCheck aria-hidden="true" size={16} />
        Quality Review
      </div>
      <div className="quality-check-list">
        {qualityChecks.length === 0 ? (
          <p className="muted">No quality checks yet.</p>
        ) : (
          qualityChecks.map((check) => (
            <article key={check.label} className={`quality-check-row ${check.status}`}>
              <strong>{check.label}</strong>
              <span>{check.status}</span>
              <p>{check.detail}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
