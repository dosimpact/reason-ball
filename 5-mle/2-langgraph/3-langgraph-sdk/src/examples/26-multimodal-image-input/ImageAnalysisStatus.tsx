import type { useMultimodalImageInput } from "./useMultimodalImageInput";

type Props = Pick<
  ReturnType<typeof useMultimodalImageInput>,
  | "finalStatus"
  | "observations"
  | "regionNotes"
  | "imageEvents"
>;

export function ImageAnalysisStatus({
  finalStatus,
  observations,
  regionNotes,
  imageEvents,
}: Props) {
  return (
    <div className={`image-status-panel ${finalStatus}`} role="region" aria-label="Image Analysis Status">
      <div className="panel-title">Image Analysis Status</div>
      <div className="image-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Observations</span>
          <strong>{observations.length}</strong>
        </div>
        <div>
          <span>Regions</span>
          <strong>{regionNotes.length}</strong>
        </div>
        <div>
          <span>Events</span>
          <strong>{imageEvents.length}</strong>
        </div>
      </div>
    </div>
  );
}
