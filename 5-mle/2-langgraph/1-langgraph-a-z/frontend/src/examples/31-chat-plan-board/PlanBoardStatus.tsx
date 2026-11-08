import type { useChatPlanBoard } from "./useChatPlanBoard";

type Props = Pick<
  ReturnType<typeof useChatPlanBoard>,
  | "finalStatus"
  | "planSteps"
  | "activeStepId"
  | "boardStatus"
>;

export function PlanBoardStatus({
  finalStatus,
  planSteps,
  activeStepId,
  boardStatus,
}: Props) {
  return (
    <div className={`plan-board-status-panel ${finalStatus}`} role="region" aria-label="Plan Board Status">
      <div className="panel-title">Plan Board Status</div>
      <div className="plan-board-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Board</span>
          <strong>{boardStatus}</strong>
        </div>
        <div>
          <span>Active Step</span>
          <strong>{activeStepId || "none"}</strong>
        </div>
        <div>
          <span>Steps</span>
          <strong>{planSteps.length}</strong>
        </div>
      </div>
    </div>
  );
}
