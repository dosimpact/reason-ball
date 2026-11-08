import { isNumber } from "remeda";
import { CheckCircle2, CircleDashed, Loader2, Sparkles } from "lucide-react";
import { z } from "zod";
import { normalizeWorkspace, buildTaskWorkspaceParameters } from "./model";
import { styles } from "./styles";

export function WorkspaceCard({ result }: { result: unknown }) {
  const parsed = normalizeWorkspace(result);
  const checklist = parsed.checklist ?? [];
  const sections = parsed.sections ?? [];
  const progress = isNumber(parsed.progress) ? parsed.progress : 0;

  return (
    <div style={styles.card} data-testid="agentic-generative-workspace">
      <div style={styles.title}>
        <Sparkles aria-hidden="true" size={18} />
        {parsed.title ?? "Generated task workspace"}
      </div>
      <span>Active step: {parsed.activeStep ?? parsed.status ?? "working"}</span>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${Math.max(0, Math.min(progress, 100))}%` }} />
      </div>
      <div style={styles.checklist}>
        {checklist.map((item) => (
          <div key={item.label} style={styles.step}>
            {item.state === "complete" ? (
              <CheckCircle2 aria-hidden="true" size={16} />
            ) : (
              <CircleDashed aria-hidden="true" size={16} />
            )}
            <span>{item.label ?? "Workspace step"}</span>
          </div>
        ))}
      </div>
      {sections.map((section) => (
        <div key={section.heading} style={styles.section}>
          <strong>{section.heading ?? "Section"}</strong>
          <span>{section.content ?? ""}</span>
        </div>
      ))}
      <strong>{parsed.summary ?? "Workspace update received."}</strong>
    </div>
  );
}

export function BuildTaskWorkspaceRenderer({ parameters, result, status }: { parameters: Partial<z.infer<typeof buildTaskWorkspaceParameters>>; result: unknown; status: string }) {
  if (status !== "complete") {
    return (
      <div style={styles.card} data-testid="agentic-generative-loading">
        <div style={styles.title}>
          <Loader2 aria-hidden="true" size={18} />
          Building workspace
        </div>
        <span>{parameters.request}</span>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: "45%" }} />
        </div>
      </div>
    );
  }

  return <WorkspaceCard result={result} />;
}
