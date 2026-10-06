import { RefreshCcw } from "lucide-react";

import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "final"
  | "canRetry"
  | "retryAnalysis"
>;

export function RetryControls({
  final,
  canRetry,
  retryAnalysis,
}: Props) {
  return (
    <div className="retry-control-panel" role="region" aria-label="Retry Controls">
      <div className="panel-title">Retry Controls</div>
      <div className="button-row">
        <button type="button" className="primary-button" onClick={retryAnalysis} disabled={!canRetry}>
          <RefreshCcw size={16} />
          Retry analysis
        </button>
      </div>
      <p className="final-line">{final || "Retry reuses the same thread and preserves the parsed dataset."}</p>
    </div>
  );
}
