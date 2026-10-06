import { Wrench } from "lucide-react";

import { formatJson } from "./model";

import type { useTodoListMiddleware } from "./useTodoListMiddleware";

type Props = Pick<
  ReturnType<typeof useTodoListMiddleware>,
  | "toolActivities"
>;

export function WritetodosToolCalls({
  toolActivities,
}: Props) {
  return (
    <div className="todo-tool-panel" role="region" aria-label="write_todos Tool Calls">
      <div className="panel-title">
        <Wrench aria-hidden="true" size={18} />
        write_todos Calls
      </div>
      <div className="todo-tool-list">
        {toolActivities.length === 0 ? (
          <p className="muted">No tool activity yet.</p>
        ) : (
          toolActivities.map((activity) => (
            <article key={activity.id} className={`tool-card ${activity.status}`}>
              <div className="tool-card-header">
                <div>
                  <strong>{activity.name}</strong>
                  <code>{activity.id}</code>
                </div>
                <span className="tool-status">{activity.status}</span>
              </div>
              <div className="tool-card-grid">
                <div>
                  <span>Arguments</span>
                  <pre>{formatJson(activity.args ?? {})}</pre>
                </div>
                <div>
                  <span>{activity.status === "error" ? "Error" : "Result"}</span>
                  <pre>{activity.result ?? "Waiting for middleware tool result"}</pre>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
