import { isPlainObject } from "remeda";
import { CheckCircle2, MousePointerClick, Workflow } from "lucide-react";
import { z } from "zod";
import { parseResult, records, buildAdvancedA2uiParameters } from "./model";

export function AdvancedCard({
  result,
  actionResult,
  onConfirm,
}: {
  result: unknown;
  actionResult: string;
  onConfirm: (selectionId: string, selectionLabel: string) => void;
}) {
  const parsed = parseResult(result);
  const panel = isPlainObject(parsed.panel) ? parsed.panel : {};
  const progress = records(parsed.progress);
  const options = records(panel.options);
  const selected = options.find((option) => option.selected === true) ?? options[0];
  const selectionId = String(selected?.id ?? "approve-staged");
  const selectionLabel = String(selected?.label ?? "Approve staged launch");

  return (
    <article className="advanced-a2ui-card" data-testid="advanced-a2ui-card">
      <header className="advanced-a2ui-header">
        <Workflow size={18} aria-hidden="true" />
        <div>
          <strong>{String(panel.title ?? "Generated decision")}</strong>
          <span>{String(parsed.schema_version ?? "advanced-a2ui-v1")}</span>
        </div>
      </header>

      <div className="advanced-a2ui-progress">
        {progress.map((step) => (
          <section key={String(step.id ?? step.label)} className={String(step.status ?? "pending")}>
            <CheckCircle2 size={15} aria-hidden="true" />
            <div>
              <strong>{String(step.label ?? "Step")}</strong>
              <span>{String(step.detail ?? "")}</span>
            </div>
          </section>
        ))}
      </div>

      <section className="advanced-a2ui-decision">
        <p>{String(panel.summary ?? "Review the generated options.")}</p>
        <div className="advanced-a2ui-options">
          {options.map((option) => (
            <article key={String(option.id ?? option.label)} className={option.selected ? "selected" : ""}>
              <strong>{String(option.label ?? "Option")}</strong>
              <span>{String(option.impact ?? "")}</span>
            </article>
          ))}
        </div>
        <button type="button" onClick={() => onConfirm(selectionId, selectionLabel)}>
          <MousePointerClick size={15} aria-hidden="true" />
          Confirm recommended action
        </button>
      </section>

      <footer>{actionResult || String(parsed.final_summary ?? "Waiting for frontend action.")}</footer>
    </article>
  );
}

export function BuildAdvancedA2uiRenderer({ result, status, actionResult, confirmSelection }: { parameters: Partial<z.infer<typeof buildAdvancedA2uiParameters>>; result: unknown; status: string; actionResult: string; confirmSelection: (selectionId: string, selectionLabel: string) => unknown }) {
  if (status !== "complete") {
    return <div className="advanced-a2ui-loading">Building advanced A2UI...</div>;
  }

  return (
    <AdvancedCard
      result={result}
      actionResult={actionResult}
      onConfirm={(selectionId, selectionLabel) => {
        void confirmSelection(selectionId, selectionLabel);
      }}
    />
  );
}
