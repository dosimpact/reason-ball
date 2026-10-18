import type { WeaveDocument, WeaveNode } from "./types.js";
export function getNode(
  document: WeaveDocument,
  id: string,
): WeaveNode | undefined {
  return document.nodes.find((node) => node.id === id);
}
export function getNodeAtLine(
  document: WeaveDocument,
  line: number,
): WeaveNode | undefined {
  return getNode(document, document.lineToNode[line]);
}
export function searchNodes(
  document: WeaveDocument,
  query: string,
): WeaveNode[] {
  const needle = query.trim().toLowerCase();
  return document.nodes.filter((node) =>
    [
      node.text,
      node.prefix,
      node.layer,
      ...node.comments.map((comment) => comment.text),
    ].some((value) => value?.toLowerCase().includes(needle)),
  );
}
