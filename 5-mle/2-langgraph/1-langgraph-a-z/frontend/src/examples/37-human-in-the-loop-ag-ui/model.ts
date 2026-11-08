import { filter, isTruthy, join, map, pipe } from "remeda";

export type ApprovalDecision = {
  decision: "approved" | "edited_and_approved" | "rejected";
  steps: string[];
  note: string;
};

export type ApprovalRequest = {
  title: string;
  steps: string[];
  riskNote: string;
  action?: string;
};

export type PendingApproval = ApprovalRequest & {
  id: string;
};

export function toStepText(steps: string[]) {
  return pipe(steps, map((step, index) => `${index + 1}. ${step}`), join("\n"));
}

export function fromStepText(text: string) {
  return pipe(text.split("\n"), map((line) => line.replace(/^\d+\.\s*/, "").trim()), filter(isTruthy));
}
