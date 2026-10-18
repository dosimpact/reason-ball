export { compileCodeWeave } from "./compiler.js";
export { getNode, getNodeAtLine, searchNodes } from "./query.js";
export {
  collapseAll,
  expandAll,
  setNodeExpanded,
  getVisibleRows,
} from "./tree.js";
export { updateNode, replaceSource } from "./edit.js";
export type {
  Direction,
  Change,
  SourceRange,
  Comment,
  WeaveNode,
  Diagnostic,
  WeaveDocument,
  TreeState,
  TreeRow,
  NodePatch,
  EditResult,
} from "./types.js";
