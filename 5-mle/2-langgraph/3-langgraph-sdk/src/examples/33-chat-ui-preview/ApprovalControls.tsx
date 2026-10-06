import { Check, Undo2 } from "lucide-react";

import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "approvalLog"
  | "final"
  | "canApprove"
  | "applyPreview"
  | "revertPreview"
>;

export function ApprovalControls({
  approvalLog,
  final,
  canApprove,
  applyPreview,
  revertPreview,
}: Props) {
  return (
    <div className="ui-approval-panel" role="region" aria-label="Approval Controls">
      <div className="panel-title">Approval Controls</div>
      <div className="button-row">
        <button type="button" className="primary-button" onClick={applyPreview} disabled={!canApprove}>
          <Check size={16} />
          Apply preview
        </button>
        <button type="button" className="secondary-button" onClick={revertPreview} disabled={!canApprove}>
          <Undo2 size={16} />
          Revert preview
        </button>
      </div>
      <div className="approval-log-list">
        {approvalLog.length === 0 ? (
          <p className="muted">{final || "Preview changes require approval before versioning."}</p>
        ) : (
          approvalLog.map((entry, index) => (
            <article key={`${entry.action}-${index}`} className="approval-log-row">
              <strong>{entry.action}</strong>
              <p>{entry.detail}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
