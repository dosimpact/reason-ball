import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "versionHistory"
>;

export function VersionHistory({
  versionHistory,
}: Props) {
  return (
    <div className="graph-version-panel" role="region" aria-label="Version History">
      <div className="panel-title">Version History</div>
      <div className="graph-version-list">
        {versionHistory.length === 0 ? (
          <p className="muted">No canvas versions yet.</p>
        ) : (
          versionHistory.map((version) => (
            <article key={version.version} className="graph-version-row">
              <strong>v{version.version}</strong>
              <p>{version.summary}</p>
              <code>{version.selectedEventId || "no-event"}</code>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
