import { useRef, useState } from "react";
import { type ApprovalDecision, type PendingApproval, type ApprovalRequest, toStepText } from "./model";

export function useHumanInTheLoopAgUiChatState() {
  const resolverRef = useRef<((decision: ApprovalDecision) => void) | null>(null);

  const [pending, setPending] = useState<PendingApproval | null>(null);

  const [draftSteps, setDraftSteps] = useState("");

  const [lastDecision, setLastDecision] = useState<ApprovalDecision | null>(null);

  function resolveApproval(decision: ApprovalDecision) {
    resolverRef.current?.(decision);
    resolverRef.current = null;
    setLastDecision(decision);
    setPending(null);
  }

  function requestApproval(request: ApprovalRequest) {
    setPending({ id: `${Date.now()}`, ...request });
    setDraftSteps(toStepText(request.steps));
    setLastDecision(null);
    return new Promise<ApprovalDecision>((resolve) => { resolverRef.current = resolve; });
  }

  return { pending, draftSteps, setDraftSteps, lastDecision, requestApproval, resolveApproval };
}
