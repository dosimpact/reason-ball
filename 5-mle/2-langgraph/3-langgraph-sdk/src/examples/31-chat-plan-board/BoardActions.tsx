import { RefreshCcw, StepForward } from "lucide-react";

import type { useChatPlanBoard } from "./useChatPlanBoard";

type Props = Pick<
  ReturnType<typeof useChatPlanBoard>,
  | "final"
  | "boardEditStatus"
  | "canContinue"
  | "continuePlan"
  | "revisePlan"
>;

export function BoardActions({
  final,
  boardEditStatus,
  canContinue,
  continuePlan,
  revisePlan,
}: Props) {
  return (
    <div className="plan-board-actions-panel" role="region" aria-label="Board Actions">
      <div className="panel-title">Board Actions</div>
      <div className="button-row">
        <button type="button" className="primary-button" onClick={continuePlan} disabled={!canContinue}>
          <StepForward size={16} />
          Continue execution
        </button>
        <button type="button" className="secondary-button" onClick={revisePlan} disabled={!canContinue}>
          <RefreshCcw size={16} />
          Replan board
        </button>
      </div>
      <p className="final-line">{boardEditStatus}</p>
      <p className="final-line">{final || "Plan steps update through the same thread."}</p>
    </div>
  );
}
