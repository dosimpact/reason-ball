import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "versionHistory"
>;

export function VersionHistory({
  versionHistory,
}: Props) {
  return (
    <div className="ui-version-panel" role="region" aria-label="Version History">
      <div className="panel-title">Version History</div>
      <div className="ui-version-list">
        {versionHistory.length === 0 ? (
          <p className="muted">No applied preview versions yet.</p>
        ) : (
          versionHistory.map((version) => (
            <article key={version.version} className="ui-version-row">
              <strong>v{version.version}</strong>
              <p>{version.summary}</p>
              <code>{version.componentName}</code>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
