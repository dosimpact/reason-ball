export type Direction = "->" | "<-";
export type Change = "added" | "removed" | "unchanged";
export interface SourceRange {
  startLine: number;
  endLine: number;
}
export interface Comment extends SourceRange {
  kind: "inline" | "block";
  text: string;
}
export interface WeaveNode extends SourceRange {
  id: string;
  kind: "layer" | "logic";
  depth: number;
  parentId: string | null;
  children: string[];
  layer: string | null;
  prefix: string | null;
  direction: Direction | null;
  change: Change;
  text: string;
  comments: Comment[];
}
export interface Diagnostic {
  code: string;
  message: string;
  line: number;
  column: number;
}
export interface WeaveDocument {
  schemaVersion: 1;
  ok: boolean;
  source: string;
  nodes: WeaveNode[];
  roots: string[];
  lineToNode: Record<number, string>;
  diagnostics: Diagnostic[];
}
export interface TreeState {
  collapsedIds: readonly string[];
}
export interface TreeRow {
  node: WeaveNode;
  expandable: boolean;
  expanded: boolean;
  tone: "added" | "removed" | "neutral";
  marker: "+" | "-" | "";
}
export interface NodePatch {
  text?: string;
  prefix?: string;
  direction?: Direction;
  change?: Change;
  inlineComment?: string | null;
  blockComment?: string | null;
}
export type EditResult =
  | { ok: true; document: WeaveDocument; nodeId?: string }
  | {
      ok: false;
      code: "conflict" | "invalid-document" | "not-found" | "invalid-edit";
      diagnostics: Diagnostic[];
    };
