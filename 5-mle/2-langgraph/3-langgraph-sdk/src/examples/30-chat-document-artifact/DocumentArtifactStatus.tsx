import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
  | "finalStatus"
  | "documentSections"
  | "qualityScore"
  | "approvalLog"
  | "lastEditor"
>;

export function DocumentArtifactStatus({
  finalStatus,
  documentSections,
  qualityScore,
  approvalLog,
  lastEditor,
}: Props) {
  return (
    <div className={`document-status-panel ${finalStatus}`} role="region" aria-label="Document Artifact Status">
      <div className="panel-title">Document Artifact Status</div>
      <div className="document-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Sections</span>
          <strong>{documentSections.length}</strong>
        </div>
        <div>
          <span>Quality</span>
          <strong>{qualityScore ? `${Math.round(qualityScore * 100)}%` : "pending"}</strong>
        </div>
        <div>
          <span>Approval</span>
          <strong>{approvalLog || "pending"}</strong>
        </div>
        <div>
          <span>Last Editor</span>
          <strong>{lastEditor}</strong>
        </div>
      </div>
    </div>
  );
}
