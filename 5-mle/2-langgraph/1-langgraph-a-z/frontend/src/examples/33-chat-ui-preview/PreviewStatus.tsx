import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "finalStatus"
  | "componentName"
  | "previewStatus"
  | "previewErrors"
>;

export function PreviewStatus({
  finalStatus,
  componentName,
  previewStatus,
  previewErrors,
}: Props) {
  return (
    <div className={`ui-preview-status-panel ${finalStatus}`} role="region" aria-label="Preview Status">
      <div className="panel-title">Preview Status</div>
      <div className="ui-preview-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Preview</span>
          <strong>{previewStatus}</strong>
        </div>
        <div>
          <span>Component</span>
          <strong>{componentName}</strong>
        </div>
        <div>
          <span>Errors</span>
          <strong>{previewErrors.length}</strong>
        </div>
      </div>
    </div>
  );
}
