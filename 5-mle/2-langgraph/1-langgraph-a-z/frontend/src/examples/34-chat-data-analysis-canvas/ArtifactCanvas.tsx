import { BarChart3 } from "lucide-react";

import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "chart"
  | "chartMax"
>;

export function ArtifactCanvas({
  chart,
  chartMax,
}: Props) {
  return (
    <div className="chart-canvas-panel" role="region" aria-label="Chart Canvas">
      <div className="panel-title">
        <BarChart3 aria-hidden="true" size={18} />
        Chart Canvas
      </div>
      {chart ? (
        <div className="analysis-chart">
          <strong>{chart.title}</strong>
          <span>{chart.metric}</span>
          {chart.data.map((datum) => (
            <div key={datum.label} className="analysis-bar-row">
              <code>{datum.label}</code>
              <div>
                <span style={{ width: `${Math.max(8, (datum.value / chartMax) * 100)}%`, background: datum.color }} />
              </div>
              <strong>{datum.value.toLocaleString()}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No chart generated yet.</p>
      )}
    </div>
  );
}
