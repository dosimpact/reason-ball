import { SlidersHorizontal } from "lucide-react";

import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "styleControls"
>;

export function StyleControls({
  styleControls,
}: Props) {
  return (
    <div className="style-controls-panel" role="region" aria-label="Style Controls">
      <div className="panel-title">
        <SlidersHorizontal aria-hidden="true" size={18} />
        Style Controls
      </div>
      <div className="style-control-list">
        {styleControls.length === 0 ? (
          <p className="muted">No style controls yet.</p>
        ) : (
          styleControls.map((control) => (
            <article key={control.id} className="style-control-row">
              <strong>{control.label}</strong>
              <code>{control.value}</code>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
