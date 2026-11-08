import { isPlainObject } from "remeda";
type NodeName = "prepare_topic" | "call_model" | "finalize";

type NodeStatus = "pending" | "running" | "done" | "error" | "skipped";

export type TimelineNode = {
  name: NodeName;
  label: string;
  status: NodeStatus;
  update: unknown;
};

export const nodeOrder: Array<Omit<TimelineNode, "status" | "update">> = [
  { name: "prepare_topic", label: "Prepare Topic" },
  { name: "call_model", label: "OpenAI Draft" },
  { name: "finalize", label: "Finalize State" },
];

export function initialNodes(): TimelineNode[] {
  return nodeOrder.map((node) => ({
    ...node,
    status: "pending",
    update: null,
  }));
}

export function getNodePayload(data: unknown, name: NodeName): unknown {
  if (!isPlainObject(data)) return undefined;
  return data[name];
}

export function markNextRunning(nodes: TimelineNode[]): TimelineNode[] {
  const nextPendingIndex = nodes.findIndex((node) => node.status === "pending");
  if (nextPendingIndex < 0) return nodes;
  return nodes.map((node, index) =>
    index === nextPendingIndex ? { ...node, status: "running" } : node,
  );
}
