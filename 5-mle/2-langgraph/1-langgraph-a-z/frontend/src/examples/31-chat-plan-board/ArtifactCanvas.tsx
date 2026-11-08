import type { DragEvent } from "react";
import { type PlanStatus, statuses } from "./model";

import type { useChatPlanBoard } from "./useChatPlanBoard";

type Props = Pick<
  ReturnType<typeof useChatPlanBoard>,
  | "planTitle"
  | "planSteps"
  | "draggingStepId"
  | "dragOverStatus"
  | "canEditBoard"
  | "handleCardDragEnd"
  | "setDraggingStepId"
  | "setDragOverStatus"
  | "moveStep"
>;

export function ArtifactCanvas({
  planTitle,
  planSteps,
  draggingStepId,
  dragOverStatus,
  canEditBoard,
  handleCardDragEnd,
  setDraggingStepId,
  setDragOverStatus,
  moveStep,
}: Props) {
  // The view translates browser drag events into a move command.
  function handleCardDragStart(event: DragEvent<HTMLElement>, stepId: string) {
    if (!canEditBoard) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", stepId);
    setDraggingStepId(stepId);
  }

  function handleColumnDragOver(event: DragEvent<HTMLElement>, targetStatus: PlanStatus) {
    if (!draggingStepId || !canEditBoard) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStatus(targetStatus);
  }

  function handleColumnDragLeave(event: DragEvent<HTMLElement>, targetStatus: PlanStatus) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDragOverStatus((current) => current === targetStatus ? "" : current);
  }

  function handleColumnDrop(event: DragEvent<HTMLElement>, targetStatus: PlanStatus) {
    event.preventDefault();
    void moveStep(event.dataTransfer.getData("text/plain") || draggingStepId, targetStatus);
  }

  return (
    <div className="plan-board-canvas-panel" role="region" aria-label="Plan Board">
      <div className="panel-title">{planTitle}</div>
      <div className="plan-board-column-grid">
        {statuses.map((statusName) => (
          <section
            key={statusName}
            className={`plan-board-column ${statusName}${dragOverStatus === statusName ? " drag-over" : ""}`}
            onDragOver={(event) => handleColumnDragOver(event, statusName)}
            onDragLeave={(event) => handleColumnDragLeave(event, statusName)}
            onDrop={(event) => void handleColumnDrop(event, statusName)}
          >
            <h3>{statusName}</h3>
            {planSteps.filter((step) => step.status === statusName).map((step) => (
              <article
                key={step.id}
                className={`plan-board-card ${step.status}${draggingStepId === step.id ? " dragging" : ""}`}
                draggable={canEditBoard}
                aria-grabbed={draggingStepId === step.id}
                onDragStart={(event) => handleCardDragStart(event, step.id)}
                onDragEnd={handleCardDragEnd}
              >
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
                <div>
                  <code>{step.id}</code>
                  <span>{step.owner}</span>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
