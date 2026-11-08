import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "finalStatus"
  | "executionEvents"
  | "checkpoints"
  | "activeNode"
>;

export function DebuggerStatus({
  finalStatus,
  executionEvents,
  checkpoints,
  activeNode,
}: Props) {
  return (
    <div className={`graph-canvas-status-panel ${finalStatus}`} role="region" aria-label="Debugger Status">
      <div className="panel-title">Debugger Status</div>
      <div className="graph-canvas-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Active Node</span>
          <strong>{activeNode || "none"}</strong>
        </div>
        <div>
          <span>Events</span>
          <strong>{executionEvents.length}</strong>
        </div>
        <div>
          <span>Checkpoints</span>
          <strong>{checkpoints.length}</strong>
        </div>
      </div>
    </div>
  );
}
