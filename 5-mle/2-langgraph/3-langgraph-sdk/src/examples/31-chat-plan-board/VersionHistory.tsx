import type { useChatPlanBoard } from "./useChatPlanBoard";

type Props = Pick<
  ReturnType<typeof useChatPlanBoard>,
  | "versionHistory"
>;

export function VersionHistory({
  versionHistory,
}: Props) {
  return (
    <div className="plan-version-panel" role="region" aria-label="Version History">
      <div className="panel-title">Version History</div>
      <div className="plan-version-list">
        {versionHistory.length === 0 ? (
          <p className="muted">No plan versions yet.</p>
        ) : (
          versionHistory.map((version) => (
            <article key={version.version} className="plan-version-row">
              <strong>v{version.version}</strong>
              <p>{version.summary}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
