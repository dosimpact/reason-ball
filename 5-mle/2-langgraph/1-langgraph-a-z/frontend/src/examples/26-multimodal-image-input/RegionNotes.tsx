import type { useMultimodalImageInput } from "./useMultimodalImageInput";

type Props = Pick<
  ReturnType<typeof useMultimodalImageInput>,
  | "regionNotes"
>;

export function RegionNotes({
  regionNotes,
}: Props) {
  return (
    <div className="region-notes-panel" role="region" aria-label="Region Notes">
      <div className="panel-title">Region Notes</div>
      <div className="region-note-list">
        {regionNotes.length === 0 ? (
          <p className="muted">Region notes appear after analysis.</p>
        ) : (
          regionNotes.map((region) => (
            <article key={region.id} className="region-note-card">
              <strong>{region.label}</strong>
              <p>{region.note}</p>
              <code>
                x {region.x.toFixed(2)} / y {region.y.toFixed(2)} / w {region.width.toFixed(2)} / h{" "}
                {region.height.toFixed(2)}
              </code>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
