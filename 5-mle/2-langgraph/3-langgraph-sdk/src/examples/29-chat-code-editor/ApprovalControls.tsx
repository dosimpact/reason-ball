import { Check, X } from "lucide-react";

import type { useChatCodeEditor } from "./useChatCodeEditor";

type Props = Pick<
  ReturnType<typeof useChatCodeEditor>,
  | "final"
  | "canApprove"
  | "resolveProposal"
>;

export function ApprovalControls({
  final,
  canApprove,
  resolveProposal,
}: Props) {
  return (
    <div className="code-approval-panel" role="region" aria-label="Approval Controls">
      <div className="panel-title">Approval Controls</div>
      <div className="button-row">
        <button type="button" className="primary-button" onClick={() => resolveProposal("approve")} disabled={!canApprove}>
          <Check size={16} />
          Approve change
        </button>
        <button type="button" className="secondary-button" onClick={() => resolveProposal("reject")} disabled={!canApprove}>
          <X size={16} />
          Reject change
        </button>
      </div>
      <p className="final-line">{final || "Diffs remain proposed until approval."}</p>
    </div>
  );
}
