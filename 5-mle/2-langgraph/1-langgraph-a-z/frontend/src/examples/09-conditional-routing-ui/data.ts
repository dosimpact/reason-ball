import { isPlainObject, isArray, isString } from "remeda";
export const samples = [
  {
    label: "Summary",
    value:
      "Summarize this release note in one sentence: LangGraph adds checkpoint replay and clearer SDK stream events for debugging.",
  },
  {
    label: "Translation",
    value: "Translate this to Korean: The deployment finished successfully.",
  },
  {
    label: "Support",
    value:
      "Customer reports a timeout after clicking deploy and needs a triage next step.",
  },
];

type BranchName = "translation" | "summary" | "support";

type BranchStatus = "pending" | "selected" | "done" | "skipped";

export type BranchCard = {
  name: BranchName;
  label: string;
  status: BranchStatus;
  reason: string;
};

export type JsonRecord = Record<string, unknown>;

export const branchOrder: BranchCard[] = [
  {
    name: "translation",
    label: "Translation Branch",
    status: "pending",
    reason: "Waiting",
  },
  {
    name: "summary",
    label: "Summary Branch",
    status: "pending",
    reason: "Waiting",
  },
  {
    name: "support",
    label: "Support Branch",
    status: "pending",
    reason: "Waiting",
  },
];

export function valuesOf(state: unknown): JsonRecord {
  if (isPlainObject(state) && isPlainObject(state.values)) return state.values;
  return isPlainObject(state) ? state : {};
}

export function normalizeBranchStatuses(value: unknown): BranchCard[] {
  if (!isArray(value)) return branchOrder;
  const byName = new Map<string, JsonRecord>();
  for (const item of value) {
    if (isPlainObject(item) && isString(item.name))
      byName.set(item.name, item);
  }
  return branchOrder.map((branch) => {
    const record = byName.get(branch.name);
    if (!record) return branch;
    const status =
      record.status === "selected" ||
      record.status === "done" ||
      record.status === "skipped"
        ? record.status
        : branch.status;
    return {
      ...branch,
      label: isString(record.label) ? record.label : branch.label,
      status,
      reason: isString(record.reason) ? record.reason : branch.reason,
    };
  });
}

export function nodePayload(
  data: unknown,
  nodeName: string,
): JsonRecord | null {
  if (!isPlainObject(data)) return null;
  const payload = data[nodeName];
  return isPlainObject(payload) ? payload : null;
}
