import { Code2 } from "lucide-react";

import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "componentCode"
  | "proposedCode"
>;

export function ComponentCode({
  componentCode,
  proposedCode,
}: Props) {
  return (
    <div className="component-code-panel" role="region" aria-label="Component Code">
      <div className="panel-title">
        <Code2 aria-hidden="true" size={18} />
        Component Code
      </div>
      <pre>{proposedCode || componentCode || "No component code yet."}</pre>
    </div>
  );
}
