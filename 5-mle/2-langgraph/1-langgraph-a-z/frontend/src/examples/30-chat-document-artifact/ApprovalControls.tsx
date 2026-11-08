import { Check, X } from "lucide-react";

import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
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
    <div className="document-approval-panel" role="region" aria-label="Approval Controls">
      <div className="panel-title">Approval Controls</div>
      <div className="button-row">
        <button type="button" className="primary-button" onClick={() => resolveProposal("approve")} disabled={!canApprove}>
          <Check size={16} />
          Approve document
        </button>
        <button type="button" className="secondary-button" onClick={() => resolveProposal("reject")} disabled={!canApprove}>
          <X size={16} />
          Reject document
        </button>
      </div>
      <p className="final-line">{final || "Document edits remain proposed until approval."}</p>
    </div>
  );
}
