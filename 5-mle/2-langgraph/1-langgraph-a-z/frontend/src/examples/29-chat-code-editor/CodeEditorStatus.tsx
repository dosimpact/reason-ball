import type { useChatCodeEditor } from "./useChatCodeEditor";

type Props = Pick<
  ReturnType<typeof useChatCodeEditor>,
  | "finalStatus"
  | "testRecords"
  | "approvalLog"
  | "hasProposal"
>;

export function CodeEditorStatus({
  finalStatus,
  testRecords,
  approvalLog,
  hasProposal,
}: Props) {
  return (
    <div className={`code-editor-status-panel ${finalStatus}`} role="region" aria-label="Code Editor Status">
      <div className="panel-title">Code Editor Status</div>
      <div className="code-editor-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Proposal</span>
          <strong>{hasProposal ? "ready" : "pending"}</strong>
        </div>
        <div>
          <span>Tests</span>
          <strong>{testRecords.length}</strong>
        </div>
        <div>
          <span>Approval</span>
          <strong>{approvalLog || "pending"}</strong>
        </div>
      </div>
    </div>
  );
}
