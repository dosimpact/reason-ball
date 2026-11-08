import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "componentTree"
>;

export function ComponentTree({
  componentTree,
}: Props) {
  return (
    <div className="component-tree-panel" role="region" aria-label="Component Tree">
      <div className="panel-title">Component Tree</div>
      <div className="component-tree-list">
        {componentTree.length === 0 ? (
          <p className="muted">No component tree yet.</p>
        ) : (
          componentTree.map((entry) => (
            <article key={entry.id} className="component-tree-row">
              <strong>{entry.name}</strong>
              <span>{entry.role}</span>
              <p>{entry.detail}</p>
              <code>{entry.id}</code>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
