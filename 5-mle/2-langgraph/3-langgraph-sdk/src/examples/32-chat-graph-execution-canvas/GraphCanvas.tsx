import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "canvasTitle"
  | "graphNodes"
  | "graphEdges"
  | "activeNode"
  | "setActiveNode"
>;

export function GraphCanvas({
  canvasTitle,
  graphNodes,
  graphEdges,
  activeNode,
  setActiveNode,
}: Props) {
  return (
    <div className="graph-canvas-panel" role="region" aria-label="Graph Execution Canvas">
      <div className="panel-title">{canvasTitle}</div>
      <div className="graph-canvas-node-grid">
        {graphNodes.length === 0 ? (
          <p className="muted">Run the graph to render debugger nodes.</p>
        ) : (
          graphNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={node.id === activeNode ? `graph-node-card ${node.status} active` : `graph-node-card ${node.status}`}
              onClick={() => setActiveNode(node.id)}
            >
              <span>{node.lane}</span>
              <strong>{node.label}</strong>
              <p>{node.detail}</p>
              <code>{node.id}</code>
            </button>
          ))
        )}
      </div>
      <div className="graph-edge-list">
        {graphEdges.map((edge) => (
          <article key={`${edge.from}-${edge.to}`} className="graph-edge-row">
            <code>{edge.from}</code>
            <span>{edge.label}</span>
            <code>{edge.to}</code>
          </article>
        ))}
      </div>
    </div>
  );
}
