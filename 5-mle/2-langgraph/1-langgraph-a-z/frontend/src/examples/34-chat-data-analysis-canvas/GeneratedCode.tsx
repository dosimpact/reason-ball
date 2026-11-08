import { Code2 } from "lucide-react";

import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "generatedCode"
>;

export function GeneratedCode({
  generatedCode,
}: Props) {
  return (
    <div className="analysis-code-panel" role="region" aria-label="Generated Code">
      <div className="panel-title">
        <Code2 aria-hidden="true" size={18} />
        Generated Code
      </div>
      <pre>{generatedCode || "No generated analysis code yet."}</pre>
    </div>
  );
}
