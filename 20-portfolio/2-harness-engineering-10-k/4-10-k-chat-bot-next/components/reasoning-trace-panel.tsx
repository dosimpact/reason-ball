"use client";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/elements/reasoning";

type TraceStep = {
  title: string;
  detail: string;
  status: "used" | "missing" | "derived";
};

type ReasoningTrace = {
  selectedOrder?: string[];
  steps?: TraceStep[];
  toolLog?: string[];
  uncertainties?: string[];
};

export function ReasoningTracePanel({
  trace,
  label = "Reasoning Trace",
}: {
  trace: ReasoningTrace;
  label?: string;
}) {
  const steps = trace.steps ?? [];
  const toolLog = trace.toolLog ?? [];
  const uncertainties = trace.uncertainties ?? [];

  const lines = [
    `### ${label}`,
    trace.selectedOrder?.length
      ? `- Priority order: ${trace.selectedOrder.join(" -> ")}`
      : null,
    "",
    steps.length ? "#### Steps" : null,
    ...steps.map(
      (step) => `- [${step.status.toUpperCase()}] ${step.title}: ${step.detail}`
    ),
    "",
    toolLog.length ? "#### Tool Log" : null,
    ...toolLog.map((entry) => `- ${entry}`),
    "",
    uncertainties.length ? "#### Uncertainties" : null,
    ...uncertainties.map((entry) => `- ${entry}`),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="mt-2">
      <Reasoning defaultOpen={false} isStreaming={false}>
        <ReasoningTrigger>{label}</ReasoningTrigger>
        <ReasoningContent>{lines}</ReasoningContent>
      </Reasoning>
    </div>
  );
}
