import { z } from "zod";
import { PlannerError } from "@/shared/lib/errors";
import { indexFlow, ancestors } from "./traverse-tree";
import { validateFlowTree } from "./validate-tree";
import type { FlowTree, FlowStep } from "../model/types";

const nodeId = z.string().min(1).max(128);
const position = z.number().int().nonnegative();
export const flowEditSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("rename"),
      nodeId,
      label: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      action: z.literal("insert"),
      parentId: nodeId,
      index: position,
      node: z
        .object({
          id: nodeId,
          kind: z.enum(["step", "note"]),
          label: z.string().min(1).max(2000),
        })
        .strict(),
    })
    .strict(),
  z.object({ action: z.literal("remove"), nodeId }).strict(),
  z
    .object({
      action: z.literal("move"),
      nodeId,
      parentId: nodeId,
      index: position,
    })
    .strict(),
]);
export type FlowEdit = z.infer<typeof flowEditSchema>;

export function editFlowTree(input: FlowTree, edit: FlowEdit): FlowTree {
  validateFlowTree(input);
  edit = flowEditSchema.parse(edit);
  const tree = structuredClone(input),
    index = indexFlow(tree);
  const fail = (message: string): never => {
    throw new PlannerError("SCHEMA_INVALID", message);
  };
  if (edit.action === "insert" && index.byId.has(edit.node.id))
    fail("이미 사용 중인 노드 ID입니다.");
  const node =
    edit.action === "insert"
      ? { ...edit.node, children: [] }
      : index.byId.get(edit.nodeId);
  if (!node) fail("노드를 찾을 수 없습니다.");
  if (node!.kind === "layer") fail("계층은 편집할 수 없습니다.");
  if (edit.action === "rename") (node as FlowStep).label = edit.label;
  else {
    if (
      edit.action === "move" &&
      (edit.parentId === node!.id ||
        ancestors(edit.parentId, index).includes(node!.id))
    )
      fail("자기 자신이나 자손으로 이동할 수 없습니다.");
    if (edit.action !== "insert") {
      const location = index.locationById.get(node!.id)!;
      index.byId.get(location.parentId!)!.children.splice(location.index, 1);
    }
    if (edit.action !== "remove") {
      const parent = index.byId.get(edit.parentId);
      if (
        !parent ||
        parent.kind === "note" ||
        (parent.kind === "layer" && node!.kind !== "step")
      )
        fail("허용되지 않는 부모입니다.");
      // For a move, index is the position after removing the source node.
      if (edit.index > parent!.children.length)
        fail("삽입 위치가 범위를 벗어났습니다.");
      parent!.children.splice(edit.index, 0, node as FlowStep);
    }
  }
  return validateFlowTree(tree);
}
