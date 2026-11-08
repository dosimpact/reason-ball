import { isArray, isPlainObject } from "remeda";
import { Network, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { parseResult, workerList, percent, runSubgraphWorkersParameters } from "./model";

export function SubgraphRunCard({ result }: { result: unknown }) {
  const parsed = parseResult(result);
  const workers = workerList(parsed.workers);
  const failedWorkers = isArray(parsed.failed_workers) ? parsed.failed_workers : [];
  const parentState = isPlainObject(parsed.parent_state) ? parsed.parent_state : {};

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

export function RunSubgraphWorkersRenderer({ result, status }: { parameters: Partial<z.infer<typeof runSubgraphWorkersParameters>>; result: unknown; status: string }) {
  if (status !== "complete") {
    return <div className="subgraphs-loading">Running worker subgraphs...</div>;
  }

  return <SubgraphRunCard result={result} />;
}
