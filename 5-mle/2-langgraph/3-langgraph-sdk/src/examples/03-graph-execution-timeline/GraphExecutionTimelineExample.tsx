import { CheckCircle2, Clock3, Loader2, Play, RotateCcw } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";


type NodeName = "prepare_topic" | "call_model" | "finalize";
type NodeStatus = "pending" | "running" | "done" | "error" | "skipped";

type TimelineNode = {
  name: NodeName;
  label: string;
  status: NodeStatus;
  update: unknown;
};

const nodeOrder: Array<Omit<TimelineNode, "status" | "update">> = [
  { name: "prepare_topic", label: "Prepare Topic" },
  { name: "call_model", label: "OpenAI Draft" },
  { name: "finalize", label: "Finalize State" },
];

function initialNodes(): TimelineNode[] {
  return nodeOrder.map((node) => ({ ...node, status: "pending", update: null }));
}

function getNodePayload(data: unknown, name: NodeName): unknown {
  if (!data || typeof data !== "object") return undefined;
  return (data as Record<string, unknown>)[name];
}

function markNextRunning(nodes: TimelineNode[]): TimelineNode[] {
  const nextPendingIndex = nodes.findIndex((node) => node.status === "pending");
  if (nextPendingIndex < 0) return nodes;
  return nodes.map((node, index) =>
    index === nextPendingIndex ? { ...node, status: "running" } : node,
  );
}

export function GraphExecutionTimelineExample() {
  const [topic, setTopic] = useState("streaming graph updates");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [nodes, setNodes] = useState<TimelineNode[]>(initialNodes);
  const [finalState, setFinalState] = useState<unknown>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);

  function resetView() {
    setNodes(initialNodes());
    setFinalState(null);
    setEvents([]);
    setError("");
    setStatus("Idle");
    setThreadId("");
  }

  async function runTimeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setFinalState(null);
    setEvents([]);
    setNodes(markNextRunning(initialNodes()));
    setStatus("Creating thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "03-graph-execution-timeline", topic: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming graph updates");

      // node_updates는 langgraph의 상태값이며 이는 직접 정의된다.  
      const stream = await client.runs.stream(nextThreadId, "03_graph_execution_timeline", {
        input: { topic: trimmed, steps: [], node_updates: [] },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 50));

        
        setNodes((current) => {
          let next = current;
          for (const node of nodeOrder) {
            const payload = getNodePayload(logEntry.data, node.name);
            if (payload !== undefined) {
              next = next.map((item) =>
                item.name === node.name ? { ...item, status: "done", update: payload } : item,
              );
            }
          }
          return markNextRunning(next);
        });
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      setFinalState(state.values ?? state);
      setNodes((current) =>
        current.map((node) => (node.status === "running" ? { ...node, status: "done" } : node)),
      );
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setNodes((current) =>
        current.map((node) => (node.status === "running" ? { ...node, status: "error" } : node)),
      );
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="timeline-layout">
      <div className="timeline-control">
        <div className="panel-title">Run Controls</div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form onSubmit={runTimeline} className="run-form">
          <label className="field">
            <span>Topic</span>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !topic.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run timeline
            </button>
            <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>
        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </div>

      <div className="timeline-panel">
        <div className="panel-title">Node Timeline</div>
        <div className="timeline-node-list">
          {nodes.map((node) => (
            <article key={node.name} className={`timeline-node ${node.status}`}>
              <div className="timeline-node-header">
                {node.status === "done" ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
                <div>
                  <strong>{node.label}</strong>
                  <code>{node.name}</code>
                </div>
                <span>{node.status}</span>
              </div>
              <pre>{node.update ? JSON.stringify(node.update, null, 2) : "Waiting for update"}</pre>
            </article>
          ))}
        </div>
      </div>

      <div className="state-panel">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? JSON.stringify(finalState, null, 2) : "No final state yet."}</pre>
      </div>

      <div className="event-panel">
        <div className="panel-title">Raw Stream Events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            events.map((entry) => (
              <details key={entry.id} className="event-row">
                <summary>
                  <span>{entry.receivedAt}</span>
                  <strong>{entry.event}</strong>
                </summary>
                <pre>{JSON.stringify(entry.data, null, 2)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
