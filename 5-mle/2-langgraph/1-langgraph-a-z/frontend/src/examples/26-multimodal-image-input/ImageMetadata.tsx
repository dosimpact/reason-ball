
import type { useMultimodalImageInput } from "./useMultimodalImageInput";

type Props = Pick<
  ReturnType<typeof useMultimodalImageInput>,
  | "imageName"
  | "imageMimeType"
  | "imageSize"
  | "metadata"
>;

export function ImageMetadata({
  imageName,
  imageMimeType,
  imageSize,
  metadata,
}: Props) {
  return (
    <div className="image-metadata-panel" role="region" aria-label="Image Metadata">
      <div className="panel-title">Image Metadata</div>
      <div className="image-metadata-grid">
        <div>
          <span>Name</span>
          <strong>{metadata?.name || imageName || "none"}</strong>
        </div>
        <div>
          <span>Type</span>
          <strong>{metadata?.mimeType || imageMimeType || "unknown"}</strong>
        </div>
        <div>
          <span>Size</span>
          <strong>{metadata?.size || imageSize || 0} bytes</strong>
        </div>
        <div>
          <span>Dimensions</span>
          <strong>{metadata ? `${metadata.width || "?"} x ${metadata.height || "?"}` : "pending"}</strong>
        </div>
      </div>
    </div>
  );
}
