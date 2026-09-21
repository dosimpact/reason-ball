import type { TreeRow, TreeState, WeaveDocument } from "./types.js";
export function collapseAll(document: WeaveDocument): TreeState {
  return {
    collapsedIds: document.nodes
      .filter((node) => node.children.length)
      .map((node) => node.id),
  };
}
export function expandAll(): TreeState {
  return { collapsedIds: [] };
}
export function setNodeExpanded(
  state: TreeState,
  nodeId: string,
  expanded: boolean,
): TreeState {
  const ids = new Set(state.collapsedIds);
  if (expanded) ids.delete(nodeId);
  else ids.add(nodeId);
  return { collapsedIds: [...ids] };
}
export function getVisibleRows(
  document: WeaveDocument,
  state: TreeState = expandAll(),
): TreeRow[] {
  const collapsed = new Set(state.collapsedIds);
  const hidden = new Set<string>();
  const rows: TreeRow[] = [];
  for (const node of document.nodes) {
    if (
      node.parentId &&
      (hidden.has(node.parentId) || collapsed.has(node.parentId))
    ) {
      hidden.add(node.id);
      continue;
    }
    rows.push({
      node,
      expandable: node.children.length > 0,
      expanded: node.children.length > 0 && !collapsed.has(node.id),
      tone: node.change === "unchanged" ? "neutral" : node.change,
      marker:
        node.change === "added" ? "+" : node.change === "removed" ? "-" : "",
    });
  }
  return rows;
}
