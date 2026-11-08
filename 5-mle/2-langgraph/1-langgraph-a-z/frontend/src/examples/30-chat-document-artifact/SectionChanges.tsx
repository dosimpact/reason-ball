import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
  | "documentSections"
>;

export function SectionChanges({
  documentSections,
}: Props) {
  return (
    <div className="section-changes-panel" role="region" aria-label="Section Changes">
      <div className="panel-title">Section Changes</div>
      <div className="section-change-list">
        {documentSections.length === 0 ? (
          <p className="muted">No section changes yet.</p>
        ) : (
          documentSections.map((section) => (
            <article key={`${section.id}-change`} className="section-change-row">
              <strong>{section.title}</strong>
              <p>{section.changeSummary}</p>
              <code>{section.id}</code>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
