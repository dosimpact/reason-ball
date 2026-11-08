import { SquareTerminal } from "lucide-react";

import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "sandboxLogs"
  | "executionErrors"
>;

export function SandboxLogs({
  sandboxLogs,
  executionErrors,
}: Props) {
  return (
    <div className="sandbox-log-panel" role="region" aria-label="Sandbox Logs">
      <div className="panel-title">
        <SquareTerminal aria-hidden="true" size={18} />
        Sandbox Logs
      </div>
      <div className="sandbox-log-list">
        {sandboxLogs.length === 0 ? (
          <p className="muted">No sandbox logs yet.</p>
        ) : (
          sandboxLogs.map((log, index) => <code key={`${log}-${index}`}>{log}</code>)
        )}
      </div>
      {executionErrors.length > 0 ? (
        <div className="execution-error-list">
          {executionErrors.map((entry, index) => (
            <p key={`${entry}-${index}`}>{entry}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
