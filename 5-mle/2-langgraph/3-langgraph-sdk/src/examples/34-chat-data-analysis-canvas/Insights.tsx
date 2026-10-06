import { Lightbulb } from "lucide-react";

import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "insightSummary"
>;

export function Insights({
  insightSummary,
}: Props) {
  return (
    <div className="insights-panel" role="region" aria-label="Insights">
      <div className="panel-title">
        <Lightbulb aria-hidden="true" size={18} />
        Insights
      </div>
      <p>{insightSummary || "No insights yet."}</p>
    </div>
  );
}
