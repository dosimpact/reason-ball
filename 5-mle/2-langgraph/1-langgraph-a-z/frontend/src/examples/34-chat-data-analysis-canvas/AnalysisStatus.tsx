import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "finalStatus"
  | "rowCount"
  | "executionStatus"
  | "executionErrors"
>;

export function AnalysisStatus({
  finalStatus,
  rowCount,
  executionStatus,
  executionErrors,
}: Props) {
  return (
    <div className={`data-canvas-status-panel ${finalStatus}`} role="region" aria-label="Analysis Status">
      <div className="panel-title">Analysis Status</div>
      <div className="data-canvas-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Execution</span>
          <strong>{executionStatus}</strong>
        </div>
        <div>
          <span>Rows</span>
          <strong>{rowCount}</strong>
        </div>
        <div>
          <span>Errors</span>
          <strong>{executionErrors.length}</strong>
        </div>
      </div>
    </div>
  );
}
