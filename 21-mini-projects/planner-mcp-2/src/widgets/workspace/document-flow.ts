import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";
import type { Document, FlowNode } from "@/entities/planner/model";

type Point = { x: number; y: number };
export function documentFlow(
  stages: FlowNode[],
  documents: Document[],
  coordinates: Record<string, Point>,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = stages.slice(1).map((stage, i) => ({
    id: `stage:${stages[i].id}:${stage.id}`,
    source: stages[i].id,
    target: stage.id,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
  const visited = new Set<string>();
  const indexes = new Map(
    documents.filter((d) => d.kind === "index").map((d) => [d.id, d]),
  );
  for (const [i, stage] of stages.entries()) {
    const origin = coordinates[stage.id] ??
      stage.coordinates ?? { x: 30 + i * 240, y: 80 };
    let row = 0;
    function append(doc: Document, parent: string, depth: number) {
      if (visited.has(doc.id) || doc.kind === "index") return;
      visited.add(doc.id);
      const id = `document:${doc.id}`;
      nodes.push({
        id,
        position: {
          x: origin.x + Math.min(depth, 3) * 16,
          y: origin.y + 110 + row++ * 90,
        },
        data: { label: doc.title, documentId: doc.id },
        className: "flow-document-node",
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        draggable: false,
      });
      edges.push({
        id: `child:${doc.id}`,
        source: parent,
        target: id,
        type: "smoothstep",
        className: "flow-document-edge",
      });
      documents
        .filter((child) => child.parentId === doc.id)
        .forEach((child) => append(child, id, depth + 1));
    }
    documents
      .filter(
        (doc) =>
          doc.kind !== "index" &&
          doc.phase === stage.phase &&
          (!doc.parentId ||
            indexes.has(doc.parentId) ||
            !documents.some((parent) => parent.id === doc.parentId)),
      )
      .forEach((doc) => append(doc, stage.id, 0));
  }
  return { nodes, edges };
}
