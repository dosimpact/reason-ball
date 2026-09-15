import { type FlowNode, type FlowTree, layerLabels } from "../model/types";

export type FlowRow = {
  node: FlowNode;
  parentId: string | null;
  depth: number;
  index: number;
  label: string;
};
export function flowRows(
  tree: FlowTree,
  collapsed: ReadonlySet<string> = new Set(),
): FlowRow[] {
  const stack = tree.layers
    .map((node, index) => ({
      node: node as FlowNode,
      parentId: null as string | null,
      depth: 0,
      index,
    }))
    .reverse();
  const rows: FlowRow[] = [];
  while (stack.length) {
    const row = stack.pop()!;
    rows.push({
      ...row,
      label:
        row.node.kind === "layer"
          ? layerLabels[row.node.layerType]
          : row.node.label,
    });
    if (collapsed.has(row.node.id)) continue;
    for (let i = row.node.children.length - 1; i >= 0; i--)
      stack.push({
        node: row.node.children[i],
        parentId: row.node.id,
        depth: row.depth + 1,
        index: i,
      });
  }
  return rows;
}

export function indexFlow(tree: FlowTree) {
  const rows = flowRows(tree);
  return {
    byId: new Map(rows.map((r) => [r.node.id, r.node])),
    parentById: new Map(rows.map((r) => [r.node.id, r.parentId])),
    locationById: new Map(
      rows.map((r) => [r.node.id, { parentId: r.parentId, index: r.index }]),
    ),
  };
}

export function ancestors(
  id: string,
  index: ReturnType<typeof indexFlow>,
): string[] {
  const result: string[] = [];
  let parent = index.parentById.get(id);
  while (parent) {
    result.push(parent);
    parent = index.parentById.get(parent);
  }
  return result;
}

export function reconcileCollapsed(tree: FlowTree, ids: ReadonlySet<string>) {
  const index = indexFlow(tree);
  return new Set(
    [...ids].filter((id) => !!index.byId.get(id)?.children.length),
  );
}

export function serializeFlowSpec(tree: FlowTree): string {
  return [
    "flow-spec 1",
    ...flowRows(tree).map(({ node, depth, label }) =>
      node.kind === "layer"
        ? `[${label}]`
        : `${"  ".repeat(depth)}${node.kind === "step" ? "->" : "(+)"} ${label}`,
    ),
  ].join("\n");
}
