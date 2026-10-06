import { previewDocument } from "./model";

import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "designSummary"
  | "previewMarkup"
  | "sandboxLogs"
>;

export function LivePreview({
  designSummary,
  previewMarkup,
  sandboxLogs,
}: Props) {
  return (
    <div className="live-preview-panel" role="region" aria-label="Live Preview">
      <div className="panel-title">Live Preview</div>
      <iframe className="preview-frame" sandbox="" srcDoc={previewDocument(previewMarkup)} title="Sandboxed UI preview" />
      {previewMarkup ? (
        <article className="preview-mirror-card" aria-label="Rendered preview card">
          <p>Generated preview</p>
          <h3>Launch command center</h3>
          <span>{designSummary || "A focused component proposal is ready for review."}</span>
          <div className="preview-mirror-metrics">
            <strong>
              92%
              <small>Readiness</small>
            </strong>
            <strong>
              4
              <small>Owners</small>
            </strong>
            <strong>
              12
              <small>Tasks</small>
            </strong>
          </div>
        </article>
      ) : null}
      <div className="sandbox-log-list">
        {sandboxLogs.length === 0 ? (
          <p className="muted">No sandbox logs yet.</p>
        ) : (
          sandboxLogs.map((log, index) => <code key={`${log}-${index}`}>{log}</code>)
        )}
      </div>
    </div>
  );
}
