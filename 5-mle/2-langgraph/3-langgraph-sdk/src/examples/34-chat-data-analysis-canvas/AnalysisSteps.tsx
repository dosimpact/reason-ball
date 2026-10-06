import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "analysisSteps"
>;

export function AnalysisSteps({
  analysisSteps,
}: Props) {
  return (
    <div className="analysis-steps-panel" role="region" aria-label="Analysis Steps">
      <div className="panel-title">Analysis Steps</div>
      <div className="analysis-step-list">
        {analysisSteps.length === 0 ? (
          <p className="muted">No analysis steps yet.</p>
        ) : (
          analysisSteps.map((step) => (
            <article key={step.id} className={`analysis-step-row ${step.status}`}>
              <strong>{step.label}</strong>
              <span>{step.status}</span>
              <p>{step.detail}</p>
              <code>{step.id}</code>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
