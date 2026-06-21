import "@copilotkit/react-core/v2/styles.css";
import "./subgraphs-ag-ui.css";
import {
  CopilotChat,
  CopilotKit,
  useAgentContext,
  useConfigureSuggestions,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { GitBranch, Network, ShieldAlert } from "lucide-react";
import { z } from "zod";

type JsonRecord = Record<string, unknown>;

type Worker = {
  id: string;
  name: string;
  task: string;
  status: string;
  progress: number;
  partialResult: string;
  result: string;
};

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResult(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseResult(parsed);
    } catch {
      return {};
    }
  }

  return isRecord(value) ? value : {};
}

function workerList(value: unknown): Worker[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((worker, index) => ({
    id: typeof worker.id === "string" ? worker.id : `worker-${index + 1}`,
    name: typeof worker.name === "string" ? worker.name : `Worker ${index + 1}`,
    task: typeof worker.task === "string" ? worker.task : "No task supplied.",
    status: typeof worker.status === "string" ? worker.status : "unknown",
    progress: typeof worker.progress === "number" ? worker.progress : Number(worker.progress ?? 0),
    partialResult: typeof worker.partial_result === "string" ? worker.partial_result : "",
    result: typeof worker.result === "string" ? worker.result : "",
  }));
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function SubgraphRunCard({ result }: { result: unknown }) {
  const parsed = parseResult(result);
  const workers = workerList(parsed.workers);
  const failedWorkers = Array.isArray(parsed.failed_workers) ? parsed.failed_workers : [];
  const parentState = isRecord(parsed.parent_state) ? parsed.parent_state : {};

  return (
    <article className="subgraphs-card" data-testid="subgraphs-progress">
      <div className="subgraphs-card-header">
        <Network size={18} aria-hidden="true" />
        <div>
          <strong>Parent graph</strong>
          <span>{String(parentState.aggregation_status ?? "running")}</span>
        </div>
      </div>

      <dl className="subgraphs-parent-state">
        <div>
          <dt>Route</dt>
          <dd>{String(parentState.route ?? "unknown")}</dd>
        </div>
        <div>
          <dt>Workers</dt>
          <dd>{String(parentState.active_worker_count ?? workers.length)}</dd>
        </div>
        <div>
          <dt>Run</dt>
          <dd>{String(parsed.run_id ?? "pending")}</dd>
        </div>
      </dl>

      <div className="subgraphs-worker-list">
        {workers.map((worker) => (
          <section key={worker.id} className={`subgraphs-worker ${worker.status}`}>
            <div className="subgraphs-worker-title">
              <strong>{worker.name}</strong>
              <span>{worker.status}</span>
            </div>
            <p>{worker.task}</p>
            <div className="subgraphs-progress-bar" aria-label={`${worker.name} progress ${percent(worker.progress)}%`}>
              <span style={{ width: `${percent(worker.progress)}%` }} />
            </div>
            <small>{worker.partialResult}</small>
            <div className="subgraphs-result">{worker.result}</div>
          </section>
        ))}
      </div>

      {failedWorkers.length > 0 ? (
        <div className="subgraphs-warning">
          <ShieldAlert size={16} aria-hidden="true" />
          {failedWorkers.length} worker failure payloads were returned.
        </div>
      ) : null}

      <p className="subgraphs-aggregate">{String(parsed.aggregate ?? "Waiting for aggregation.")}</p>
    </article>
  );
}

function Chat() {
  useAgentContext({
    description: "Current AG-UI example",
    value: "Example 44: Subgraphs AG-UI",
  });

  useRenderTool({
    name: "run_subgraph_workers",
    parameters: z.object({
      task: z.string().describe("The task that should be routed through worker subgraphs."),
    }),
    render: ({ result, status }) => {
      if (status !== "complete") {
        return <div className="subgraphs-loading">Running worker subgraphs...</div>;
      }

      return <SubgraphRunCard result={result} />;
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Coordinate workers",
        message:
          "Use the subgraph workers to prepare a release readiness brief with research, analysis, and writing outputs.",
      },
      {
        title: "Plan incident review",
        message: "Run subgraphs for an incident review: collect facts, rank risks, and draft the response.",
      },
    ],
    available: "always",
  });

  return (
    <section className="subgraphs-ag-ui-shell">
      <aside className="subgraphs-side-panel">
        <div className="subgraphs-side-title">
          <GitBranch size={18} aria-hidden="true" />
          Subgraph State
        </div>
        <p>
          The backend tool returns a parent state plus stable worker rows. The renderer keeps failed workers separate
          from completed workers so manual testing can inspect each path.
        </p>
        <ul>
          <li>Parent route and aggregation status</li>
          <li>Named worker subgraph results</li>
          <li>Final aggregate response</li>
        </ul>
      </aside>
      <div className="subgraphs-chat-panel">
        <CopilotChat agentId="subgraphs_ag_ui" className="subgraphs-chat-window" />
      </div>
    </section>
  );
}

export function SubgraphsAgUiExample() {
  return (
    <CopilotKit runtimeUrl={copilotRuntimeUrl()} showDevConsole={false} agent="subgraphs_ag_ui">
      <Chat />
    </CopilotKit>
  );
}
