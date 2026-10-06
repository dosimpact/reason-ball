import type { useChatCodeEditor } from "./useChatCodeEditor";

type Props = Pick<
  ReturnType<typeof useChatCodeEditor>,
  | "artifactHistory"
>;

export function VersionHistory({
  artifactHistory,
}: Props) {
  return (
    <div className="code-history-panel" role="region" aria-label="Version History">
      <div className="panel-title">Version History</div>
      <div className="code-history-list">
        {artifactHistory.length === 0 ? (
          <p className="muted">No applied versions yet.</p>
        ) : (
          artifactHistory.map((version, index) => (
            <article key={`${version.path}-${index}`} className="code-history-row">
              <strong>v{index + 1} {version.path}</strong>
              <p>{version.summary}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
