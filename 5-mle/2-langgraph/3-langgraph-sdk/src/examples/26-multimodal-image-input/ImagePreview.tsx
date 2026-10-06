import type { useMultimodalImageInput } from "./useMultimodalImageInput";

type Props = Pick<
  ReturnType<typeof useMultimodalImageInput>,
  | "imageDataUrl"
  | "imageName"
  | "regionNotes"
>;

export function ImagePreview({
  imageDataUrl,
  imageName,
  regionNotes,
}: Props) {
  return (
    <div className="image-preview-panel" role="region" aria-label="Image Preview">
      <div className="panel-title">Image Preview</div>
      {imageDataUrl ? (
        <div className="image-preview-frame">
          <img src={imageDataUrl} alt={imageName || "Uploaded image preview"} />
          {regionNotes.map((region) => (
            <span
              key={region.id}
              className="region-overlay"
              style={{
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.width * 100}%`,
                height: `${region.height * 100}%`,
              }}
            >
              {region.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">Upload an image or use the sample image to preview it before sending.</p>
      )}
    </div>
  );
}
