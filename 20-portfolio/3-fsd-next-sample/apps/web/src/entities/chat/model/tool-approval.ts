import { z } from "zod";
import type { UIMessage } from "ai";

const identifier = z.string().min(1).max(200);
const approvalPart = z.object({
  type: z.string().refine((value) => value === "dynamic-tool" || value.startsWith("tool-")),
  state: z.literal("approval-responded"),
  toolCallId: identifier,
  approval: z.object({ id: identifier, approved: z.boolean(), reason: z.string().max(500).optional() }),
});
const assistantTurn = z.object({
  id: z.uuid(), role: z.literal("assistant"), parts: z.array(z.unknown()).min(1).max(100),
});
const decidedToolPart = approvalPart.omit({ state: true });

export type ToolApprovalDecision = { approvalId: string; toolCallId: string; approved: boolean; reason?: string };

// Extract decisions only. Text, input, output, signatures and provider metadata
// must come from the saved assistant, never from this untrusted client message.
export function readToolApprovalTurn(message: unknown): { assistantMessageId: string; decisions: ToolApprovalDecision[] } {
  const parsed = assistantTurn.parse(message);
  const decisions = parsed.parts.filter((part) => part !== null && typeof part === "object" && "state" in part && part.state === "approval-responded")
    .map((part) => {
      const { toolCallId, approval } = approvalPart.parse(part);
      return { toolCallId, approvalId: approval.id, approved: approval.approved, ...(approval.reason !== undefined ? { reason: approval.reason } : {}) };
    });
  if (decisions.length < 1 || decisions.length > 20
    || new Set(decisions.map((item) => item.approvalId)).size !== decisions.length
    || new Set(decisions.map((item) => item.toolCallId)).size !== decisions.length) {
    throw new Error("A unique, bounded set of tool approval decisions is required.");
  }
  return { assistantMessageId: parsed.id, decisions: decisions.toSorted((left, right) => left.approvalId.localeCompare(right.approvalId)) };
}

export function hasToolApprovalResponse(message: UIMessage | undefined): boolean {
  return message?.role === "assistant" && message.parts.some((part) => approvalPart.safeParse(part).success);
}

export function hasToolApprovalDecision(message: UIMessage | undefined): boolean {
  return message?.role === "assistant" && message.parts.some((part) => decidedToolPart.safeParse(part).success);
}

// A persisted checkpoint wins over local state. If the first request never
// reached storage, apply only decisions still matching the saved pending calls.
export function planToolApprovalRetry<T extends UIMessage>(saved: readonly T[], visible: readonly T[]): T[] | undefined {
  const latest = saved.at(-1);
  if (!latest || latest.role !== "assistant") return;
  if (hasToolApprovalResponse(latest)) return [...saved];
  const local = visible.at(-1);
  if (!local || local.id !== latest.id || !hasToolApprovalResponse(local)) return;
  const { decisions } = readToolApprovalTurn(local);
  let applied = 0;
  const parts = latest.parts.map((part) => {
    if (!("state" in part) || part.state !== "approval-requested" || !("toolCallId" in part) || !("approval" in part)) return part;
    const approval = part.approval as { id: string };
    const decision = decisions.find((item) => item.approvalId === approval.id && item.toolCallId === part.toolCallId);
    if (!decision) return part;
    applied += 1;
    return { ...part, state: "approval-responded", approval: { ...approval, approved: decision.approved, ...(decision.reason !== undefined ? { reason: decision.reason } : {}) } };
  });
  if (applied !== decisions.length || parts.some((part) => "state" in part && part.state === "approval-requested")) return;
  return [...saved.slice(0, -1), { ...latest, parts } as T];
}
