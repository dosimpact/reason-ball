import { GitCompare } from "lucide-react";

import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "diffLines"
>;

export function DiffPreview({
  diffLines,
}: Props) {
  return (
    <div className="ui-diff-panel" role="region" aria-label="Diff Preview">
      <div className="panel-title">
        <GitCompare aria-hidden="true" size={18} />
        Diff Preview
      </div>
      <pre>{diffLines.length ? diffLines.join("\n") : "No diff yet."}</pre>
    </div>
  );
}
