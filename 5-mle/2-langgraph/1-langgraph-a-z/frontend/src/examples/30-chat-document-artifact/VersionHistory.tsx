import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
  | "versionHistory"
>;

export function VersionHistory({
  versionHistory,
}: Props) {
  return (
    <div className="document-history-panel" role="region" aria-label="Version History">
      <div className="panel-title">Version History</div>
      <div className="document-history-list">
        {versionHistory.length === 0 ? (
          <p className="muted">No document versions yet.</p>
        ) : (
          versionHistory.map((version) => (
            <article key={version.version} className="document-history-row">
              <strong>v{version.version} {version.title}</strong>
              <p>{version.summary}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
